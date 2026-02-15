// src/modules/templates/templates.service.ts

import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { TemplateStatus, Prisma } from '@prisma/client';
import {
  CreateTemplateInput,
  UpdateTemplateInput,
  TemplatesQueryInput,
  TemplateResponse,
  TemplatesListResponse,
  TemplateStats,
  TemplatePreview,
  TemplateButton,
  TemplateVariable,
} from './templates.types';
import { whatsappApi } from '../whatsapp/whatsapp.api';
import { metaService } from '../meta/meta.service';

// ============================================
// HELPERS
// ============================================

const formatTemplate = (template: any): TemplateResponse => ({
  id: template.id,
  name: template.name,
  language: template.language,
  category: template.category,
  headerType: template.headerType,
  headerContent: template.headerContent,
  bodyText: template.bodyText,
  footerText: template.footerText,
  buttons: (template.buttons as TemplateButton[]) || [],
  variables: (template.variables as TemplateVariable[]) || [],
  status: template.status,
  metaTemplateId: template.metaTemplateId,
  rejectionReason: template.rejectionReason,
  createdAt: template.createdAt,
  updatedAt: template.updatedAt,
  // Add WhatsApp account info if included
  whatsappAccount: (template as any).whatsappAccount ? {
    id: (template as any).whatsappAccount.id,
    phoneNumber: (template as any).whatsappAccount.phoneNumber,
    displayName: (template as any).whatsappAccount.displayName,
  } : undefined,
  wabaId: (template as any).wabaId,
  whatsappAccountId: (template as any).whatsappAccountId,
});

// Extract variables from body text ({{1}}, {{2}}, etc.)
const extractVariables = (text: string): number[] => {
  const regex = /\{\{(\d+)\}\}/g;
  const variables: number[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    variables.push(parseInt(match[1], 10));
  }
  return [...new Set(variables)].sort((a, b) => a - b);
};

const replaceVariables = (text: string, values: Record<string, string>): string => {
  return text.replace(/\{\{(\d+)\}\}/g, (match, index) => values[index] || match);
};

const toJsonValue = (value: any): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));

const toMetaLanguage = (lang: string) => {
  if (!lang) return 'en_US';
  if (lang.includes('_')) return lang;

  const languageMap: Record<string, string> = {
    'en': 'en_US',
    'hi': 'hi_IN',
    'es': 'es_ES',
    'pt': 'pt_BR',
    'ar': 'ar_SA',
    'fr': 'fr_FR',
    'de': 'de_DE',
    'it': 'it_IT',
    'ru': 'ru_RU',
    'zh': 'zh_CN',
  };

  return languageMap[lang] || 'en_US';
};

const normalizeHeaderType = (t?: string | null) => {
  const headerType = String(t || 'NONE').toUpperCase();
  return ['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType) ? headerType : 'NONE';
};

const buildMetaTemplatePayload = (t: {
  name: string;
  language: string;
  category: string;
  headerType?: string | null;
  headerContent?: string | null;
  bodyText: string;
  footerText?: string | null;
  buttons?: TemplateButton[];
}) => {
  const components: any[] = [];
  const headerType = normalizeHeaderType(t.headerType);

  // HEADER
  if (headerType && headerType !== 'NONE') {
    if (headerType === 'TEXT' && t.headerContent) {
      const headerVars = extractVariables(t.headerContent);
      const headerComp: any = {
        type: 'HEADER',
        format: 'TEXT',
        text: t.headerContent
      };

      if (headerVars.length > 0) {
        headerComp.example = {
          header_text: headerVars.map((i) => `Example${i}`)
        };
      }
      components.push(headerComp);
    } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType)) {
      // Media header requires header_handle
      throw new AppError(
        `HeaderType ${headerType} requires media upload. Use TEXT header for now.`,
        400
      );
    }
  }

  // BODY
  const bodyVars = extractVariables(t.bodyText);
  const bodyComp: any = { type: 'BODY', text: t.bodyText };

  if (bodyVars.length > 0) {
    bodyComp.example = {
      body_text: [bodyVars.map((i) => `Example${i}`)]
    };
  }
  components.push(bodyComp);

  // FOOTER
  if (t.footerText) {
    components.push({ type: 'FOOTER', text: t.footerText });
  }

  // BUTTONS
  if (t.buttons && t.buttons.length > 0) {
    const buttons = t.buttons.slice(0, 3).map((b: any) => {
      const type = String(b.type || '').toUpperCase();

      if (type.includes('URL')) {
        if (!b.url) throw new AppError('URL button requires url field', 400);
        return { type: 'URL', text: b.text, url: b.url };
      }

      if (type.includes('PHONE')) {
        if (!b.phoneNumber) throw new AppError('PHONE button requires phoneNumber field', 400);
        return { type: 'PHONE_NUMBER', text: b.text, phone_number: b.phoneNumber };
      }

      return { type: 'QUICK_REPLY', text: b.text };
    });

    components.push({ type: 'BUTTONS', buttons });
  }

  return {
    name: t.name,
    language: toMetaLanguage(t.language),
    category: String(t.category || 'UTILITY').toUpperCase(),
    components,
  };
};

/**
 * Get WhatsApp Account with decrypted token
 */
const getWhatsAppAccountWithToken = async (
  organizationId: string,
  whatsappAccountId?: string
) => {
  try {
    console.log('🔍 Getting WhatsApp account for org:', organizationId, 'accountId:', whatsappAccountId);

    // Get WhatsApp account
    const where: Prisma.WhatsAppAccountWhereInput = {
      organizationId,
      status: 'CONNECTED',
    };

    if (whatsappAccountId) {
      where.id = whatsappAccountId;
    } else {
      where.isDefault = true;
    }

    const waAccount = await prisma.whatsAppAccount.findFirst({
      where,
      orderBy: { isDefault: 'desc' },
    });

    if (!waAccount) {
      throw new AppError(
        'No connected WhatsApp account found. Please connect WhatsApp first.',
        400
      );
    }

    if (!waAccount.wabaId) {
      throw new AppError('WABA ID missing on WhatsApp account.', 400);
    }

    // Get decrypted token using metaService
    const accountWithToken = await metaService.getAccountWithToken(waAccount.id);

    if (!accountWithToken) {
      throw new AppError('Failed to decrypt access token. Please reconnect WhatsApp.', 400);
    }

    console.log('✅ Using WhatsApp Account:', waAccount.id, 'WABA:', waAccount.wabaId);

    return {
      account: waAccount,
      accessToken: accountWithToken.accessToken,
      wabaId: waAccount.wabaId,
      phoneNumberId: waAccount.phoneNumberId,
    };
  } catch (error: any) {
    console.error('❌ Get WhatsApp account error:', error);

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      'Failed to get WhatsApp credentials: ' + error.message,
      500
    );
  }
};

// ============================================
// SERVICE CLASS
// ============================================

export class TemplatesService {
  // ==========================================
  // VALIDATE TEMPLATE
  // ==========================================
  validateTemplate(input: CreateTemplateInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Name validation
    if (!/^[a-z0-9_]+$/.test(input.name)) {
      errors.push('Template name must be lowercase with underscores only (a-z, 0-9, _)');
    }

    if (input.name.length < 1 || input.name.length > 512) {
      errors.push('Template name must be between 1 and 512 characters');
    }

    // Body text validation
    if (!input.bodyText || input.bodyText.trim().length === 0) {
      errors.push('Body text is required');
    }

    if (input.bodyText && input.bodyText.length > 1024) {
      errors.push('Body text exceeds 1024 characters');
    }

    // Header validation
    const headerType = normalizeHeaderType(input.headerType);
    if (headerType === 'TEXT' && input.headerContent) {
      if (input.headerContent.length > 60) {
        errors.push('Header text exceeds 60 characters');
      }
    }

    // Footer validation
    if (input.footerText && input.footerText.length > 60) {
      errors.push('Footer text exceeds 60 characters');
    }

    // Buttons validation
    if (input.buttons && input.buttons.length > 3) {
      errors.push('Maximum 3 buttons allowed');
    }

    // Variables validation
    const varsInBody = extractVariables(input.bodyText);
    for (let i = 0; i < varsInBody.length; i++) {
      if (varsInBody[i] !== i + 1) {
        errors.push(`Variables must be sequential starting from {{1}}. Found gap at {{${i + 1}}}`);
        break;
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // ==========================================
  // CREATE TEMPLATE
  // ==========================================
  async create(
    organizationId: string,
    input: CreateTemplateInput & { whatsappAccountId?: string }
  ): Promise<TemplateResponse> {
    const {
      name,
      language,
      category,
      headerType,
      headerContent,
      bodyText,
      footerText,
      buttons,
      variables,
      whatsappAccountId
    } = input;

    // Validate template
    const validation = this.validateTemplate(input);
    if (!validation.valid) {
      throw new AppError(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }

    // Get WhatsApp account
    const waData = await getWhatsAppAccountWithToken(organizationId, whatsappAccountId);

    // Check for duplicates (now considers WABA)
    const existing = await prisma.template.findFirst({
      where: {
        organizationId,
        name,
        language,
        wabaId: waData.wabaId,
      } as any,
    });

    if (existing) {
      throw new AppError('Template with this name and language already exists for this WhatsApp account', 409);
    }

    // Auto-extract variables if not provided
    const extractedVars = extractVariables(bodyText);
    const finalVariables =
      variables && variables.length > 0
        ? variables
        : extractedVars.map((index) => ({ index, type: 'text' as const }));

    // Create local template first - LINKED TO WHATSAPP ACCOUNT
    const template = await prisma.template.create({
      data: {
        organizationId,
        whatsappAccountId: waData.account.id,
        wabaId: waData.wabaId,
        name,
        language,
        category,
        headerType: headerType || null,
        headerContent: headerContent || null,
        bodyText,
        footerText: footerText || null,
        buttons: toJsonValue(buttons || []),
        variables: toJsonValue(finalVariables),
        status: 'PENDING',
        metaTemplateId: null,
        rejectionReason: null,
      } as any,
    });

    console.log(`✅ Template created locally: ${template.id} for WABA: ${waData.wabaId}`);

    // Submit to Meta
    try {
      const metaPayload = buildMetaTemplatePayload({
        name,
        language,
        category,
        headerType: headerType || null,
        headerContent: headerContent || null,
        bodyText,
        footerText: footerText || null,
        buttons: (buttons || []) as any,
      });

      console.log('📤 Submitting template to Meta:', { name, wabaId: waData.wabaId });

      const metaRes = await whatsappApi.createMessageTemplate(
        waData.wabaId,
        waData.accessToken,
        metaPayload
      );

      const metaTemplateId = metaRes?.id || metaRes?.template_id;

      if (!metaTemplateId) {
        throw new AppError('Meta did not return template ID', 502);
      }

      await prisma.template.update({
        where: { id: template.id },
        data: {
          metaTemplateId: String(metaTemplateId),
          status: 'PENDING',
          rejectionReason: null,
        },
      });

      console.log('✅ Meta template created:', { metaTemplateId, name });
    } catch (e: any) {
      const msg = String(e?.response?.data?.error?.message || e?.message || 'Meta submission failed');
      console.error('❌ Meta template create failed:', e?.response?.data || e);

      // Mark as rejected locally
      await prisma.template.update({
        where: { id: template.id },
        data: {
          status: 'REJECTED',
          rejectionReason: msg,
        },
      });
    }

    const latest = await prisma.template.findUnique({
      where: { id: template.id },
      include: {
        whatsappAccount: {
          select: {
            id: true,
            phoneNumber: true,
            displayName: true,
          },
        },
      } as any,
    });

    return formatTemplate(latest);
  }

  // ==========================================
  // GET TEMPLATES LIST
  // ==========================================
  async getList(
    organizationId: string,
    query: TemplatesQueryInput & { whatsappAccountId?: string }
  ): Promise<TemplatesListResponse> {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      category,
      language,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      whatsappAccountId,
    } = query;

    const skip = (page - 1) * limit;
    const where: Prisma.TemplateWhereInput = { organizationId };

    // Filter by WhatsApp account
    if (whatsappAccountId) {
      const waAccount = await prisma.whatsAppAccount.findFirst({
        where: {
          id: whatsappAccountId,
          organizationId,
        },
        select: { wabaId: true },
      });

      if (waAccount) {
        (where as any).wabaId = waAccount.wabaId;
      } else {
        return {
          templates: [],
          meta: { page, limit, total: 0, totalPages: 0 },
        };
      }
    } else {
      // Default account's WABA
      const defaultAccount = await prisma.whatsAppAccount.findFirst({
        where: {
          organizationId,
          isDefault: true,
          status: 'CONNECTED',
        },
        select: { wabaId: true },
      });

      if (defaultAccount) {
        (where as any).wabaId = defaultAccount.wabaId;
      }
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { bodyText: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) where.status = status;
    if (category) where.category = category;
    if (language) where.language = language;

    const [templates, total] = await Promise.all([
      prisma.template.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          whatsappAccount: {
            select: {
              id: true,
              phoneNumber: true,
              displayName: true,
            },
          },
        } as any,
      }),
      prisma.template.count({ where }),
    ]);

    return {
      templates: templates.map(formatTemplate),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
    };
  }

  // ==========================================
  // GET APPROVED TEMPLATES
  // ==========================================
  async getApprovedTemplates(
    organizationId: string,
    whatsappAccountId?: string
  ): Promise<TemplateResponse[]> {
    const where: Prisma.TemplateWhereInput = {
      organizationId,
      status: 'APPROVED',
    };

    if (whatsappAccountId) {
      const waAccount = await prisma.whatsAppAccount.findFirst({
        where: {
          id: whatsappAccountId,
          organizationId,
        },
        select: { wabaId: true },
      });

      if (waAccount) {
        (where as any).wabaId = waAccount.wabaId;
      } else {
        return [];
      }
    }

    const templates = await prisma.template.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        whatsappAccount: {
          select: {
            id: true,
            phoneNumber: true,
            displayName: true,
          },
        },
      } as any,
    });

    return templates.map(formatTemplate);
  }

  // ==========================================
  // SYNC FROM META
  // ==========================================
  async syncFromMeta(
    organizationId: string,
    whatsappAccountId?: string
  ): Promise<{ message: string; synced: number }> {
    console.log('🔄 Syncing templates from Meta...');

    const waData = await getWhatsAppAccountWithToken(organizationId, whatsappAccountId);

    const metaTemplates = await whatsappApi.listMessageTemplates(
      waData.wabaId,
      waData.accessToken
    );

    console.log(`📥 Found ${metaTemplates.length} templates in Meta for WABA: ${waData.wabaId}`);

    let synced = 0;
    for (const mt of metaTemplates) {
      const metaId = String(mt.id);
      const metaName = String(mt.name);
      const metaLang = String(mt.language);

      const metaStatusRaw = String(mt.status || 'PENDING').toUpperCase();
      const mappedStatus: TemplateStatus =
        metaStatusRaw === 'APPROVED' ? 'APPROVED' :
          metaStatusRaw === 'REJECTED' ? 'REJECTED' : 'PENDING';

      const local = await prisma.template.findFirst({
        where: {
          organizationId,
          wabaId: waData.wabaId,
          OR: [
            { metaTemplateId: metaId },
            { name: metaName, language: metaLang }
          ],
        } as any,
      });

      const rejectionReason = mt.rejected_reason || mt.rejection_reason || null;

      // Extract template components
      const bodyComponent = mt.components?.find((c: any) => c.type === 'BODY');
      const headerComponent = mt.components?.find((c: any) => c.type === 'HEADER');
      const footerComponent = mt.components?.find((c: any) => c.type === 'FOOTER');
      const buttonsComponent = mt.components?.find((c: any) => c.type === 'BUTTONS');

      if (local) {
        // Update existing
        await prisma.template.update({
          where: { id: local.id },
          data: {
            metaTemplateId: metaId,
            status: mappedStatus,
            rejectionReason,
            whatsappAccountId: waData.account.id,
          } as any,
        });
      } else {
        // Create new
        await prisma.template.create({
          data: {
            organizationId,
            whatsappAccountId: waData.account.id,
            wabaId: waData.wabaId,
            name: metaName,
            language: metaLang,
            category: (String(mt.category || 'UTILITY').toUpperCase()) as any,
            bodyText: bodyComponent?.text || 'Imported from Meta',
            headerType: headerComponent?.format || null,
            headerContent: headerComponent?.text || null,
            footerText: footerComponent?.text || null,
            status: mappedStatus,
            metaTemplateId: metaId,
            buttons: toJsonValue(buttonsComponent?.buttons || []),
            variables: toJsonValue(this.extractVariablesFromComponents(mt.components)),
            rejectionReason,
          } as any,
        });
      }

      synced++;
    }

    console.log(`✅ Synced ${synced} templates from Meta for WABA: ${waData.wabaId}`);

    return { message: 'Templates synced from Meta', synced };
  }

  // ==========================================
  // GET TEMPLATE BY ID
  // ==========================================
  async getById(organizationId: string, templateId: string): Promise<TemplateResponse> {
    const template = await prisma.template.findFirst({
      where: { id: templateId, organizationId },
      include: {
        whatsappAccount: {
          select: {
            id: true,
            phoneNumber: true,
            displayName: true,
            wabaId: true,
          },
        },
      } as any,
    });

    if (!template) {
      throw new AppError('Template not found', 404);
    }

    return formatTemplate(template);
  }

  // ==========================================
  // UPDATE TEMPLATE
  // ==========================================
  async update(
    organizationId: string,
    templateId: string,
    input: UpdateTemplateInput
  ): Promise<TemplateResponse> {
    const existing = await prisma.template.findFirst({
      where: { id: templateId, organizationId }
    });

    if (!existing) {
      throw new AppError('Template not found', 404);
    }

    if (existing.status === 'APPROVED' && existing.metaTemplateId) {
      throw new AppError(
        'Cannot modify approved templates. Create a new template instead.',
        400
      );
    }

    let finalVariables = input.variables;
    if (input.bodyText) {
      const extracted = extractVariables(input.bodyText);
      if (!finalVariables || finalVariables.length === 0) {
        finalVariables = extracted.map((index) => ({ index, type: 'text' as const }));
      }
    }

    const updateData: Prisma.TemplateUpdateInput = {
      name: input.name,
      language: input.language,
      category: input.category,
      headerType: input.headerType,
      headerContent: input.headerContent,
      bodyText: input.bodyText,
      footerText: input.footerText,
    };

    if (input.buttons !== undefined) updateData.buttons = toJsonValue(input.buttons);
    if (finalVariables !== undefined) updateData.variables = toJsonValue(finalVariables);

    // Reset to pending if content changed
    if (input.bodyText || input.headerContent) {
      updateData.status = 'PENDING';
    }

    const updated = await prisma.template.update({
      where: { id: templateId },
      data: updateData,
      include: {
        whatsappAccount: {
          select: {
            id: true,
            phoneNumber: true,
            displayName: true,
          },
        },
      } as any,
    });

    console.log(`✅ Template updated: ${templateId}`);

    return formatTemplate(updated);
  }

  // ==========================================
  // DELETE TEMPLATE
  // ==========================================
  async delete(organizationId: string, templateId: string): Promise<{ message: string }> {
    const template = await prisma.template.findFirst({
      where: { id: templateId, organizationId }
    });

    if (!template) {
      throw new AppError('Template not found', 404);
    }

    await prisma.template.delete({ where: { id: templateId } });

    console.log(`✅ Template deleted: ${templateId}`);

    return { message: 'Template deleted successfully' };
  }

  // ==========================================
  // GET TEMPLATE STATS
  // ==========================================
  async getStats(
    organizationId: string,
    whatsappAccountId?: string
  ): Promise<TemplateStats> {
    try {
      const where: Prisma.TemplateWhereInput = { organizationId };

      if (whatsappAccountId) {
        const waAccount = await prisma.whatsAppAccount.findFirst({
          where: {
            id: whatsappAccountId,
            organizationId,
          },
          select: { wabaId: true },
        });

        if (waAccount) {
          (where as any).wabaId = waAccount.wabaId;
        }
      }

      const [total, pending, approved, rejected, marketing, utility, authentication] = await Promise.all([
        prisma.template.count({ where }),
        prisma.template.count({ where: { ...where, status: 'PENDING' } }),
        prisma.template.count({ where: { ...where, status: 'APPROVED' } }),
        prisma.template.count({ where: { ...where, status: 'REJECTED' } }),
        prisma.template.count({ where: { ...where, category: 'MARKETING' } }),
        prisma.template.count({ where: { ...where, category: 'UTILITY' } }),
        prisma.template.count({ where: { ...where, category: 'AUTHENTICATION' } }),
      ]);

      return {
        total,
        pending,
        approved,
        rejected,
        byCategory: {
          marketing,
          utility,
          authentication,
        },
      };
    } catch (error: any) {
      console.error('❌ Get template stats error:', error);

      return {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        byCategory: { marketing: 0, utility: 0, authentication: 0 },
      };
    }
  }

  // ==========================================
  // DUPLICATE TEMPLATE
  // ==========================================
  async duplicate(
    organizationId: string,
    templateId: string,
    newName: string,
    targetWhatsappAccountId?: string
  ): Promise<TemplateResponse> {
    const original = await prisma.template.findFirst({
      where: { id: templateId, organizationId },
      include: {
        whatsappAccount: true,
      } as any,
    });

    if (!original) {
      throw new AppError('Template not found', 404);
    }

    // Determine target account
    const targetAccountId = targetWhatsappAccountId || (original as any).whatsappAccountId;
    let targetWabaId = (original as any).wabaId;

    if (targetWhatsappAccountId && targetWhatsappAccountId !== (original as any).whatsappAccountId) {
      // Get target account's WABA ID
      const targetAccount = await prisma.whatsAppAccount.findFirst({
        where: {
          id: targetWhatsappAccountId,
          organizationId,
        },
        select: { wabaId: true },
      });

      if (targetAccount) {
        targetWabaId = targetAccount.wabaId;
      }
    }

    // Check for duplicates in target WABA
    const dup = await prisma.template.findFirst({
      where: {
        organizationId,
        name: newName,
        language: original.language,
        wabaId: targetWabaId,
      } as any,
    });

    if (dup) {
      throw new AppError('Template with this name already exists for this WhatsApp account', 409);
    }

    const created = await prisma.template.create({
      data: {
        organizationId,
        whatsappAccountId: targetAccountId,
        wabaId: targetWabaId,
        name: newName,
        language: original.language,
        category: original.category,
        headerType: original.headerType,
        headerContent: original.headerContent,
        bodyText: original.bodyText,
        footerText: original.footerText,
        buttons: original.buttons || toJsonValue([]),
        variables: original.variables || toJsonValue([]),
        status: 'PENDING',
        metaTemplateId: null,
        rejectionReason: null,
      } as any,
      include: {
        whatsappAccount: {
          select: {
            id: true,
            phoneNumber: true,
            displayName: true,
          },
        },
      },
    } as any);

    console.log(`📋 Template duplicated: ${templateId} -> ${created.id}`);

    return formatTemplate(created);
  }

  // ==========================================
  // PREVIEW TEMPLATE
  // ==========================================
  async preview(
    bodyText: string,
    variables: Record<string, string> = {},
    headerType?: string,
    headerContent?: string,
    footerText?: string,
    buttons?: TemplateButton[]
  ): Promise<TemplatePreview> {
    const preview: TemplatePreview = {
      body: replaceVariables(bodyText, variables)
    };

    const normalizedHeaderType = normalizeHeaderType(headerType);

    if (normalizedHeaderType === 'TEXT' && headerContent) {
      preview.header = replaceVariables(headerContent, variables);
    } else if (normalizedHeaderType !== 'NONE') {
      preview.header = `[${normalizedHeaderType}]`;
    }

    if (footerText) {
      preview.footer = footerText;
    }

    if (buttons && buttons.length > 0) {
      preview.buttons = buttons.map((btn) => ({
        type: btn.type,
        text: btn.text
      }));
    }

    return preview;
  }

  // ==========================================
  // SUBMIT TO META
  // ==========================================
  async submitToMeta(
    organizationId: string,
    templateId: string
  ): Promise<{ message: string; metaTemplateId?: string }> {
    const template = await prisma.template.findFirst({
      where: { id: templateId, organizationId }
    });

    if (!template) {
      throw new AppError('Template not found', 404);
    }

    // Use the template's linked WhatsApp account
    const waData = await getWhatsAppAccountWithToken(organizationId, (template as any).whatsappAccountId || undefined);

    const metaPayload = buildMetaTemplatePayload({
      name: template.name,
      language: template.language,
      category: template.category,
      headerType: template.headerType,
      headerContent: template.headerContent,
      bodyText: template.bodyText,
      footerText: template.footerText,
      buttons: (template.buttons as any) || [],
    });

    console.log('📤 Submitting template to Meta:', { templateId, name: template.name });

    const metaRes = await whatsappApi.createMessageTemplate(
      waData.wabaId,
      waData.accessToken,
      metaPayload
    );

    const metaTemplateId = metaRes?.id || metaRes?.template_id;

    await prisma.template.update({
      where: { id: template.id },
      data: {
        metaTemplateId: metaTemplateId ? String(metaTemplateId) : template.metaTemplateId,
        status: 'PENDING',
        rejectionReason: null,
      },
    });

    console.log('✅ Template submitted to Meta:', metaTemplateId);

    return {
      message: 'Template submitted to Meta. It will appear as PENDING until approved.',
      metaTemplateId: metaTemplateId ? String(metaTemplateId) : undefined,
    };
  }

  // ==========================================
  // GET LANGUAGES
  // ==========================================
  async getLanguages(
    organizationId: string,
    whatsappAccountId?: string
  ): Promise<{ language: string; count: number }[]> {
    const where: Prisma.TemplateWhereInput = { organizationId };

    if (whatsappAccountId) {
      const waAccount = await prisma.whatsAppAccount.findFirst({
        where: {
          id: whatsappAccountId,
          organizationId,
        },
        select: { wabaId: true },
      });

      if (waAccount) {
        (where as any).wabaId = waAccount.wabaId;
      }
    }

    const templates = await prisma.template.groupBy({
      by: ['language'],
      where,
      _count: { language: true },
      orderBy: { _count: { language: 'desc' } },
    });

    return templates.map((t) => ({
      language: t.language,
      count: t._count.language
    }));
  }

  // ==========================================
  // UPDATE STATUS (Internal - webhook handler)
  // ==========================================
  async updateStatus(
    metaTemplateId: string,
    status: TemplateStatus,
    rejectionReason?: string
  ): Promise<void> {
    await prisma.template.updateMany({
      where: { metaTemplateId },
      data: {
        status,
        rejectionReason: rejectionReason || null
      },
    });

    console.log(`✅ Template status updated: ${metaTemplateId} -> ${status}`);
  }

  // Helper to extract variables from Meta components
  private extractVariablesFromComponents(components: any[]): any {
    if (!Array.isArray(components)) return [];

    const variables: any[] = [];

    // Check body component
    const body = components.find((c) => c.type === 'BODY');
    if (body && body.text) {
      const matches = body.text.match(/\{\{(\d+)\}\}/g);
      if (matches) {
        matches.forEach((match: string, index: number) => {
          variables.push({
            index: index + 1,
            type: 'text',
          });
        });
      }
    }

    return variables;
  }
}

export const templatesService = new TemplatesService();