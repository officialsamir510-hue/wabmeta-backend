// 📁 src/modules/templates/templates.service.ts - FINAL COMPLETE VERSION

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
import { safeDecryptStrict } from '../../utils/encryption';

// ============================================
// TYPES
// ============================================

interface WhatsAppAccountData {
  id: string;
  phoneNumberId: string;
  wabaId: string;
  phoneNumber: string;
  accessToken: string;
  status: string;
  isDefault?: boolean;
}

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
  whatsappAccount: undefined,
  wabaId: template.wabaId || null,
  whatsappAccountId: template.whatsappAccountId || null,
});

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

const toJsonValue = (value: any): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value));

/**
 * ✅ IMPROVED: Keep language as-is, no forced conversion
 * Meta accepts both formats: "en", "en_US", "hi", "hi_IN"
 */
const toMetaLanguage = (lang?: string): string => {
  const l = String(lang || '').trim();
  if (!l) return 'en_US';

  // If already has underscore (en_US, hi_IN), return as-is
  if (l.includes('_')) return l;

  // Return short code as-is (en, hi, es)
  return l;
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

  // Header component
  if (headerType && headerType !== 'NONE') {
    if (headerType === 'TEXT' && t.headerContent) {
      const headerVars = extractVariables(t.headerContent);
      const headerComp: any = {
        type: 'HEADER',
        format: 'TEXT',
        text: t.headerContent,
      };

      if (headerVars.length > 0) {
        headerComp.example = {
          header_text: headerVars.map((i) => `Example${i}`),
        };
      }
      components.push(headerComp);
    } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType)) {
      throw new AppError(
        `HeaderType ${headerType} requires media upload. Use TEXT header for now.`,
        400
      );
    }
  }

  // Body component
  const bodyVars = extractVariables(t.bodyText);
  const bodyComp: any = { type: 'BODY', text: t.bodyText };

  if (bodyVars.length > 0) {
    bodyComp.example = {
      body_text: [bodyVars.map((i) => `Example${i}`)],
    };
  }
  components.push(bodyComp);

  // Footer component
  if (t.footerText) {
    components.push({ type: 'FOOTER', text: t.footerText });
  }

  // Buttons component
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
 * ✅ FIXED: Get WhatsApp Account with robust retry logic
 */
const getWhatsAppAccountWithToken = async (
  organizationId: string,
  whatsappAccountId?: string
): Promise<{
  account: WhatsAppAccountData;
  accessToken: string;
  wabaId: string;
  phoneNumberId: string;
}> => {
  const MAX_RETRIES = 5;
  const RETRY_DELAYS = [500, 1000, 2000, 3000, 5000]; // Progressive delays

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      console.log(`🔍 [Attempt ${attempt + 1}/${MAX_RETRIES}] Getting WhatsApp account:`, {
        organizationId,
        whatsappAccountId: whatsappAccountId || 'auto-detect',
      });

      // ============================================
      // METHOD 1: Try WhatsAppAccount table
      // ============================================
      let waAccount = null;

      if (whatsappAccountId) {
        // ✅ Direct ID lookup (most reliable)
        waAccount = await prisma.whatsAppAccount.findFirst({
          where: {
            id: whatsappAccountId,
            organizationId,
          },
        });

        console.log(`   Direct lookup by ID:`, waAccount ? '✅ Found' : '❌ Not found');
      }

      // ✅ Fallback: Find ANY connected account for this org
      if (!waAccount) {
        waAccount = await prisma.whatsAppAccount.findFirst({
          where: {
            organizationId,
            status: 'CONNECTED',
          },
          orderBy: [
            { isDefault: 'desc' },
            { createdAt: 'desc' },
          ],
        });

        console.log(`   Fallback connected lookup:`, waAccount ? '✅ Found' : '❌ Not found');
      }

      // ✅ Last resort: Find ANY account for this org (even pending)
      if (!waAccount) {
        waAccount = await prisma.whatsAppAccount.findFirst({
          where: {
            organizationId,
          },
          orderBy: { createdAt: 'desc' },
        });

        console.log(`   Last resort lookup:`, waAccount ? `✅ Found (status: ${waAccount.status})` : '❌ Not found');
      }

      // ============================================
      // METHOD 2: Try MetaConnection table (new structure)
      // ============================================
      if (!waAccount) {
        console.log('📋 Trying MetaConnection table...');

        try {
          const metaConnection = await (prisma as any).metaConnection.findUnique({
            where: { organizationId },
            include: {
              phoneNumbers: {
                where: { isActive: true },
                orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
              },
            },
          });

          if (metaConnection && metaConnection.phoneNumbers?.length > 0) {
            const primaryPhone = metaConnection.phoneNumbers[0];

            console.log('✅ Found via MetaConnection:', {
              wabaId: metaConnection.wabaId,
              phone: primaryPhone.phoneNumber,
            });

            // Decrypt token
            const decryptedToken = safeDecryptStrict(metaConnection.accessToken);

            if (!decryptedToken) {
              throw new AppError('Failed to decrypt MetaConnection token', 500);
            }

            return {
              account: {
                id: primaryPhone.id,
                phoneNumberId: primaryPhone.phoneNumberId,
                wabaId: metaConnection.wabaId,
                phoneNumber: primaryPhone.phoneNumber,
                accessToken: decryptedToken,
                status: metaConnection.status,
              },
              accessToken: decryptedToken,
              wabaId: metaConnection.wabaId,
              phoneNumberId: primaryPhone.phoneNumberId,
            };
          }
        } catch (metaError: any) {
          console.log('⚠️ MetaConnection not available:', metaError.message);
        }
      }

      // ============================================
      // Account Found - Validate & Return
      // ============================================
      if (waAccount) {
        console.log('✅ WhatsApp account found:', {
          id: waAccount.id,
          phone: waAccount.phoneNumber,
          status: waAccount.status,
          wabaId: waAccount.wabaId,
        });

        // Check if account has required fields
        if (!waAccount.wabaId) {
          throw new AppError(
            'WhatsApp Business Account ID missing. Please reconnect in Settings → WhatsApp.',
            400
          );
        }

        if (!waAccount.accessToken) {
          throw new AppError(
            'WhatsApp access token missing. Please reconnect in Settings → WhatsApp.',
            400
          );
        }

        // Get decrypted token
        const accountWithToken = await metaService.getAccountWithToken(waAccount.id);

        if (!accountWithToken) {
          throw new AppError(
            'Failed to decrypt token. Please reconnect in Settings → WhatsApp.',
            400
          );
        }

        return {
          account: {
            id: waAccount.id,
            phoneNumberId: waAccount.phoneNumberId,
            wabaId: waAccount.wabaId,
            phoneNumber: waAccount.phoneNumber,
            accessToken: accountWithToken.accessToken,
            status: waAccount.status,
            isDefault: waAccount.isDefault,
          },
          accessToken: accountWithToken.accessToken,
          wabaId: waAccount.wabaId,
          phoneNumberId: waAccount.phoneNumberId,
        };
      }

      // ============================================
      // Account Not Found - Retry or Throw
      // ============================================
      if (attempt < MAX_RETRIES - 1) {
        const delay = RETRY_DELAYS[attempt];
        console.log(`⏳ Account not found, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // All retries exhausted
      throw new AppError(
        'No WhatsApp account found. Please connect your WhatsApp Business account in Settings → WhatsApp.',
        400
      );

    } catch (error: any) {
      // If it's a retryable error and we have retries left
      if (
        attempt < MAX_RETRIES - 1 &&
        (error.message.includes('not found') || error.message.includes('No WhatsApp'))
      ) {
        const delay = RETRY_DELAYS[attempt];
        console.log(`⏳ Error: ${error.message}, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Non-retryable or retries exhausted
      console.error('❌ getWhatsAppAccountWithToken failed:', error);
      throw error;
    }
  }

  // Should never reach here, but TypeScript requires it
  throw new AppError('No WhatsApp account found after all retries.', 400);
};

// ============================================
// SERVICE CLASS
// ============================================

export class TemplatesService {
  /**
   * Validate template before creation/update
   */
  validateTemplate(input: CreateTemplateInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Name validation
    if (!/^[a-z0-9_]+$/.test(input.name)) {
      errors.push('Template name must be lowercase with underscores only (a-z, 0-9, _)');
    }

    if (input.name.length < 1 || input.name.length > 512) {
      errors.push('Template name must be between 1 and 512 characters');
    }

    // Body validation
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

  /**
   * Create new template
   */
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
      whatsappAccountId,
    } = input;

    // Validate template
    const validation = this.validateTemplate(input);
    if (!validation.valid) {
      throw new AppError(`Validation failed: ${validation.errors.join(', ')}`, 400);
    }

    // ✅ Try to get WhatsApp account (supports both table structures)
    let waData: Awaited<ReturnType<typeof getWhatsAppAccountWithToken>> | null = null;
    let canSyncToMeta = false;

    try {
      waData = await getWhatsAppAccountWithToken(organizationId, whatsappAccountId);
      canSyncToMeta = true;
      console.log('✅ WhatsApp account found, will sync to Meta');
    } catch (err) {
      console.warn('⚠️ No WhatsApp account found, creating local-only template');
      canSyncToMeta = false;
    }

    // Check for duplicates
    const existing = await prisma.template.findFirst({
      where: {
        organizationId,
        name,
        language,
      },
    });

    if (existing) {
      throw new AppError('Template with this name and language already exists', 409);
    }

    // Extract variables
    const extractedVars = extractVariables(bodyText);
    const finalVariables =
      variables && variables.length > 0
        ? variables
        : extractedVars.map((index) => ({ index, type: 'text' as const }));

    // Create template data
    const templateData: any = {
      organizationId,
      name,
      language,
      category,
      headerType: headerType || null,
      headerContent: headerContent || null,
      bodyText,
      footerText: footerText || null,
      buttons: toJsonValue(buttons || []),
      variables: toJsonValue(finalVariables),
      status: canSyncToMeta ? 'PENDING' : 'DRAFT',
      metaTemplateId: null,
      rejectionReason: null,
    };

    // Store wabaId and whatsappAccountId if available
    if (waData) {
      if (waData.wabaId) {
        templateData.wabaId = waData.wabaId;
      }
      if (waData.account?.id) {
        templateData.whatsappAccountId = waData.account.id;
      }
    }

    // Create template in database
    const template = await prisma.template.create({
      data: templateData,
    });

    console.log(`✅ Template created: ${template.id} (status: ${template.status})`);

    // ✅ Submit to Meta if account is available
    if (canSyncToMeta && waData) {
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

        console.log('📤 Submitting template to Meta WABA:', waData.wabaId);
        console.log('📝 Template language:', toMetaLanguage(language));

        const metaRes = await whatsappApi.createMessageTemplate(
          waData.wabaId,
          waData.accessToken,
          metaPayload
        );

        const metaTemplateId = metaRes?.id || metaRes?.template_id;

        if (metaTemplateId) {
          await prisma.template.update({
            where: { id: template.id },
            data: {
              metaTemplateId: String(metaTemplateId),
              status: 'PENDING',
            },
          });
          console.log('✅ Meta template created:', metaTemplateId);
        }
      } catch (e: any) {
        const metaErr = e?.response?.data?.error;
        const msg = String(metaErr?.message || e?.message || 'Meta submission failed');

        console.error('❌ Meta template create failed:', {
          code: metaErr?.code,
          message: metaErr?.message,
          error_subcode: metaErr?.error_subcode,
          error_data: metaErr?.error_data,
          templateName: name,
          language: toMetaLanguage(language),
        });

        await prisma.template.update({
          where: { id: template.id },
          data: {
            status: 'REJECTED',
            rejectionReason: msg,
          },
        });
      }
    }

    // Fetch latest template state
    const latest = await prisma.template.findUnique({
      where: { id: template.id },
    });

    return formatTemplate(latest);
  }

  /**
   * Get list of templates with filtering
   */
  async getList(
    organizationId: string,
    query: TemplatesQueryInput & { whatsappAccountId?: string; wabaId?: string }
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
      wabaId,
    } = query;

    const skip = (page - 1) * limit;
    const where: Prisma.TemplateWhereInput = { organizationId };

    if (search && search.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { bodyText: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    if (status) where.status = status;
    if (category) where.category = category;
    if (language) where.language = language;

    // Filter by whatsappAccountId or wabaId
    if (whatsappAccountId) {
      (where as any).whatsappAccountId = whatsappAccountId;
    }
    if (wabaId) {
      (where as any).wabaId = wabaId;
    }

    const [templates, total] = await Promise.all([
      prisma.template.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.template.count({ where }),
    ]);

    console.log(`📋 Found ${templates.length} templates (total: ${total})`);

    return {
      templates: templates.map(formatTemplate),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get approved templates only
   */
  async getApprovedTemplates(
    organizationId: string,
    whatsappAccountId?: string,
    wabaId?: string
  ): Promise<TemplateResponse[]> {
    const where: Prisma.TemplateWhereInput = {
      organizationId,
      status: 'APPROVED',
    };

    if (wabaId) {
      (where as any).wabaId = wabaId;
    } else if (whatsappAccountId) {
      (where as any).whatsappAccountId = whatsappAccountId;
    }

    const templates = await prisma.template.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    console.log(`📋 Found ${templates.length} approved templates`);

    return templates.map(formatTemplate);
  }

  /**
   * Sync templates from Meta
   */
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

    console.log(`📥 Found ${metaTemplates.length} templates in Meta`);

    let synced = 0;
    for (const mt of metaTemplates) {
      try {
        const metaId = String(mt.id);
        const metaName = String(mt.name);
        const metaLang = String(mt.language);

        const metaStatusRaw = String(mt.status || 'PENDING').toUpperCase();
        const mappedStatus: TemplateStatus =
          metaStatusRaw === 'APPROVED'
            ? 'APPROVED'
            : metaStatusRaw === 'REJECTED'
              ? 'REJECTED'
              : 'PENDING';

        const rejectionReason = mt.rejected_reason || mt.rejection_reason || null;

        const bodyComponent = mt.components?.find((c: any) => c.type === 'BODY');
        const headerComponent = mt.components?.find((c: any) => c.type === 'HEADER');
        const footerComponent = mt.components?.find((c: any) => c.type === 'FOOTER');
        const buttonsComponent = mt.components?.find((c: any) => c.type === 'BUTTONS');

        const existing = await prisma.template.findFirst({
          where: {
            organizationId,
            name: metaName,
            language: metaLang,
          },
        });

        if (existing) {
          // Update existing
          const updateData: any = {
            metaTemplateId: metaId,
            status: mappedStatus,
            rejectionReason,
            category: (String(mt.category || 'UTILITY').toUpperCase()) as any,
          };

          if (waData.wabaId) updateData.wabaId = waData.wabaId;
          if (waData.account?.id) updateData.whatsappAccountId = waData.account.id;

          await prisma.template.update({
            where: { id: existing.id },
            data: updateData,
          });
        } else {
          // Create new
          const createData: any = {
            organizationId,
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
            variables: toJsonValue([]),
            rejectionReason,
          };

          if (waData.wabaId) createData.wabaId = waData.wabaId;
          if (waData.account?.id) createData.whatsappAccountId = waData.account.id;

          await prisma.template.create({ data: createData });
        }

        synced++;
      } catch (err: any) {
        console.error(`Failed to sync template ${mt.name}:`, err.message);
      }
    }

    console.log(`✅ Synced ${synced} templates from Meta`);

    return { message: 'Templates synced from Meta', synced };
  }

  /**
   * Get template by ID
   */
  async getById(organizationId: string, templateId: string): Promise<TemplateResponse> {
    const template = await prisma.template.findFirst({
      where: { id: templateId, organizationId },
    });

    if (!template) {
      throw new AppError('Template not found', 404);
    }

    return formatTemplate(template);
  }

  /**
   * Update template
   */
  async update(
    organizationId: string,
    templateId: string,
    input: UpdateTemplateInput
  ): Promise<TemplateResponse> {
    const existing = await prisma.template.findFirst({
      where: { id: templateId, organizationId },
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

    if (input.bodyText || input.headerContent) {
      updateData.status = 'PENDING';
    }

    const updated = await prisma.template.update({
      where: { id: templateId },
      data: updateData,
    });

    console.log(`✅ Template updated: ${templateId}`);

    return formatTemplate(updated);
  }

  /**
   * Delete template
   */
  async delete(organizationId: string, templateId: string): Promise<{ message: string }> {
    const template = await prisma.template.findFirst({
      where: { id: templateId, organizationId },
    });

    if (!template) {
      throw new AppError('Template not found', 404);
    }

    await prisma.template.delete({ where: { id: templateId } });

    console.log(`✅ Template deleted: ${templateId}`);

    return { message: 'Template deleted successfully' };
  }

  /**
   * Get template statistics
   */
  async getStats(organizationId: string, whatsappAccountId?: string): Promise<TemplateStats> {
    try {
      const where: Prisma.TemplateWhereInput = { organizationId };

      if (whatsappAccountId) {
        (where as any).whatsappAccountId = whatsappAccountId;
      }

      const [total, pending, approved, rejected, marketing, utility, authentication] =
        await Promise.all([
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
        byCategory: { marketing, utility, authentication },
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

  /**
   * Duplicate template
   */
  async duplicate(
    organizationId: string,
    templateId: string,
    newName: string,
    targetWhatsappAccountId?: string
  ): Promise<TemplateResponse> {
    const original = await prisma.template.findFirst({
      where: { id: templateId, organizationId },
    });

    if (!original) {
      throw new AppError('Template not found', 404);
    }

    const dup = await prisma.template.findFirst({
      where: {
        organizationId,
        name: newName,
        language: original.language,
      },
    });

    if (dup) {
      throw new AppError('Template with this name already exists', 409);
    }

    const createData: any = {
      organizationId,
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
    };

    if ((original as any).wabaId) createData.wabaId = (original as any).wabaId;
    if ((original as any).whatsappAccountId)
      createData.whatsappAccountId = (original as any).whatsappAccountId;

    const created = await prisma.template.create({ data: createData });

    console.log(`📋 Template duplicated: ${templateId} -> ${created.id}`);

    return formatTemplate(created);
  }

  /**
   * Preview template with variables
   */
  async preview(
    bodyText: string,
    variables: Record<string, string> = {},
    headerType?: string,
    headerContent?: string,
    footerText?: string,
    buttons?: TemplateButton[]
  ): Promise<TemplatePreview> {
    const preview: TemplatePreview = {
      body: replaceVariables(bodyText, variables),
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
        text: btn.text,
      }));
    }

    return preview;
  }

  /**
   * Submit template to Meta
   */
  async submitToMeta(
    organizationId: string,
    templateId: string,
    whatsappAccountId?: string
  ): Promise<{ message: string; metaTemplateId?: string }> {
    const template = await prisma.template.findFirst({
      where: { id: templateId, organizationId },
    });

    if (!template) {
      throw new AppError('Template not found', 404);
    }

    const waData = await getWhatsAppAccountWithToken(organizationId, whatsappAccountId);

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

    console.log('📤 Submitting template to Meta:', {
      templateId,
      name: template.name,
      language: toMetaLanguage(template.language),
    });

    const metaRes = await whatsappApi.createMessageTemplate(
      waData.wabaId,
      waData.accessToken,
      metaPayload
    );

    const metaTemplateId = metaRes?.id || metaRes?.template_id;

    const updateData: any = {
      metaTemplateId: metaTemplateId ? String(metaTemplateId) : template.metaTemplateId,
      status: 'PENDING',
      rejectionReason: null,
    };
    if (waData.wabaId) updateData.wabaId = waData.wabaId;
    if (waData.account?.id) updateData.whatsappAccountId = waData.account.id;

    await prisma.template.update({
      where: { id: template.id },
      data: updateData,
    });

    console.log('✅ Template submitted to Meta:', metaTemplateId);

    return {
      message: 'Template submitted to Meta. It will appear as PENDING until approved.',
      metaTemplateId: metaTemplateId ? String(metaTemplateId) : undefined,
    };
  }

  /**
   * Get available languages
   */
  async getLanguages(
    organizationId: string,
    whatsappAccountId?: string
  ): Promise<{ language: string; count: number }[]> {
    const where: Prisma.TemplateWhereInput = { organizationId };

    if (whatsappAccountId) {
      (where as any).whatsappAccountId = whatsappAccountId;
    }

    const templates = await prisma.template.groupBy({
      by: ['language'],
      where,
      _count: { language: true },
      orderBy: { _count: { language: 'desc' } },
    });

    return templates.map((t) => ({
      language: t.language,
      count: t._count.language,
    }));
  }

  /**
   * Update template status (called from webhook)
   */
  async updateStatus(
    metaTemplateId: string,
    status: TemplateStatus,
    rejectionReason?: string
  ): Promise<void> {
    await prisma.template.updateMany({
      where: { metaTemplateId },
      data: {
        status,
        rejectionReason: rejectionReason || null,
      },
    });

    console.log(`✅ Template status updated: ${metaTemplateId} -> ${status}`);
  }

  /**
   * Sync templates for specific account
   */
  async syncTemplatesForAccount(organizationId: string, whatsappAccountId: string) {
    return metaService.syncTemplates(whatsappAccountId, organizationId);
  }
}

export const templatesService = new TemplatesService();
export default templatesService;