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
import { EncryptionUtil } from '../../utils/encryption';

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
  if (lang === 'en') return 'en_US';
  if (lang === 'hi') return 'hi_IN';
  return 'en_US';
};

const normalizeHeaderType = (t?: string | null) => String(t || 'NONE').toUpperCase();

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

  // HEADER (TEXT supported)
  if (headerType && headerType !== 'NONE') {
    if (headerType === 'TEXT' && t.headerContent) {
      const headerVars = extractVariables(t.headerContent);
      const headerComp: any = { type: 'HEADER', format: 'TEXT', text: t.headerContent };

      if (headerVars.length > 0) {
        headerComp.example = { header_text: headerVars.map((i) => `Example${i}`) };
      }
      components.push(headerComp);
    } else {
      // Media header requires header_handle; keep strict to avoid silent Meta errors
      throw new AppError(
        `HeaderType ${headerType} needs media upload + header_handle example. Use TEXT header for now.`,
        400
      );
    }
  }

  // BODY
  const bodyVars = extractVariables(t.bodyText);
  const bodyComp: any = { type: 'BODY', text: t.bodyText };

  if (bodyVars.length > 0) {
    bodyComp.example = { body_text: [bodyVars.map((i) => `Example${i}`)] };
  }
  components.push(bodyComp);

  // FOOTER
  if (t.footerText) components.push({ type: 'FOOTER', text: t.footerText });

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
 * ✅ Multi-tenant credentials resolver
 * Priority:
 * 1) MetaConnection (new connect flow, token encrypted)
 * 2) WhatsAppAccount (old/manual connect flow)
 */
const getConnectedWabaCredentials = async (organizationId: string, whatsappAccountId?: string) => {
  // 1) MetaConnection (new)
  const metaConn = await prisma.metaConnection.findUnique({
    where: { organizationId },
    include: {
      phoneNumbers: {
        where: { isActive: true },
        orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }],
      },
    },
  });

  if (metaConn && metaConn.status === 'CONNECTED' && metaConn.accessToken && metaConn.wabaId) {
    const accessToken = EncryptionUtil.decrypt(metaConn.accessToken);

    return {
      source: 'META_CONNECTION' as const,
      wabaId: metaConn.wabaId,
      accessToken,
      phoneNumberId: metaConn.phoneNumbers?.[0]?.phoneNumberId || null,
    };
  }

  // 2) WhatsAppAccount fallback (manual/old)
  const wa = await prisma.whatsAppAccount.findFirst({
    where: {
      organizationId,
      status: 'CONNECTED',
      ...(whatsappAccountId ? { id: whatsappAccountId } : { isDefault: true }),
    },
  });

  if (!wa) throw new AppError('WhatsApp account not connected. Connect WhatsApp first.', 400);
  if (!wa.wabaId) throw new AppError('WABA ID missing on WhatsApp account.', 400);
  if (!wa.accessToken) throw new AppError('Access token missing on WhatsApp account.', 400);

  return {
    source: 'WHATSAPP_ACCOUNT' as const,
    wabaId: wa.wabaId,
    accessToken: wa.accessToken,
    phoneNumberId: wa.phoneNumberId || null,
  };
};

// ============================================
// SERVICE
// ============================================

export class TemplatesService {
  // ==========================================
  // VALIDATE TEMPLATE
  // ==========================================
  validateTemplate(input: CreateTemplateInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!/^[a-z0-9_]+$/.test(input.name)) {
      errors.push('Template name must be lowercase with underscores only');
    }

    if (input.bodyText.length > 1024) {
      errors.push('Body text exceeds 1024 characters');
    }

    const headerType = normalizeHeaderType(input.headerType);
    if (headerType === 'TEXT' && input.headerContent && input.headerContent.length > 60) {
      errors.push('Header text exceeds 60 characters');
    }

    if (input.footerText && input.footerText.length > 60) {
      errors.push('Footer text exceeds 60 characters');
    }

    if (input.buttons && input.buttons.length > 3) {
      errors.push('Maximum 3 buttons allowed');
    }

    const varsInBody = extractVariables(input.bodyText);
    for (let i = 0; i < varsInBody.length; i++) {
      if (varsInBody[i] !== i + 1) {
        errors.push(`Variables must be sequential starting from 1. Found gap at {{${i + 1}}}`);
        break;
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // ==========================================
  // CREATE TEMPLATE (local + Meta submit)
  // ==========================================
  async create(organizationId: string, input: CreateTemplateInput): Promise<TemplateResponse> {
    const { name, language, category, headerType, headerContent, bodyText, footerText, buttons, variables } = input;

    const existing = await prisma.template.findUnique({
      where: {
        organizationId_name_language: { organizationId, name, language },
      },
    });

    if (existing) throw new AppError('Template with this name and language already exists', 409);

    // Auto-extract vars if not provided
    const extractedVars = extractVariables(bodyText);
    const finalVariables =
      variables && variables.length > 0
        ? variables
        : extractedVars.map((index) => ({ index, type: 'text' as const }));

    // Create local template first
    const template = await prisma.template.create({
      data: {
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
        status: 'PENDING',
        metaTemplateId: null,
        rejectionReason: null,
      },
    });

    // Submit to Meta
    try {
      const wa = await getConnectedWabaCredentials(organizationId);

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

      const metaRes = await whatsappApi.createMessageTemplate(wa.wabaId, wa.accessToken, metaPayload);
      const metaTemplateId = metaRes?.id || metaRes?.template_id;

      if (!metaTemplateId) {
        throw new AppError('Meta did not return template ID. Submission may have failed.', 502);
      }

      await prisma.template.update({
        where: { id: template.id },
        data: {
          metaTemplateId: String(metaTemplateId),
          status: 'PENDING',
          rejectionReason: null,
        },
      });

      console.log('✅ Meta template created:', { metaTemplateId, name, source: wa.source });
    } catch (e: any) {
      const msg = String(e?.response?.data?.error?.message || e?.message || 'Meta submission failed');
      console.error('❌ Meta template create failed:', e?.response?.data || e);

      // Mark as rejected locally so UI shows what happened
      await prisma.template.update({
        where: { id: template.id },
        data: {
          status: 'REJECTED',
          rejectionReason: msg,
        },
      });
    }

    const latest = await prisma.template.findUnique({ where: { id: template.id } });
    return formatTemplate(latest);
  }

  // ==========================================
  // DUPLICATE
  // ==========================================
  async duplicate(organizationId: string, templateId: string, newName: string): Promise<TemplateResponse> {
    const original = await prisma.template.findFirst({ where: { id: templateId, organizationId } });
    if (!original) throw new AppError('Template not found', 404);

    const dup = await prisma.template.findUnique({
      where: {
        organizationId_name_language: {
          organizationId,
          name: newName,
          language: original.language,
        },
      },
    });

    if (dup) throw new AppError('Template with this name already exists', 409);

    const created = await prisma.template.create({
      data: {
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
      },
    });

    return formatTemplate(created);
  }

  // ==========================================
  // GET APPROVED TEMPLATES
  // ==========================================
  async getApprovedTemplates(organizationId: string): Promise<TemplateResponse[]> {
    const templates = await prisma.template.findMany({
      where: { organizationId, status: 'APPROVED' },
      orderBy: { name: 'asc' },
    });
    return templates.map(formatTemplate);
  }

  // ==========================================
  // GET LANGUAGES
  // ==========================================
  async getLanguages(organizationId: string): Promise<{ language: string; count: number }[]> {
    const templates = await prisma.template.groupBy({
      by: ['language'],
      where: { organizationId },
      _count: { language: true },
      orderBy: { _count: { language: 'desc' } },
    });

    return templates.map((t) => ({ language: t.language, count: t._count.language }));
  }

  // ==========================================
  // LIST
  // ==========================================
  async getList(organizationId: string, query: TemplatesQueryInput): Promise<TemplatesListResponse> {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      category,
      language,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.TemplateWhereInput = { organizationId };

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
      prisma.template.findMany({ where, skip, take: limit, orderBy: { [sortBy]: sortOrder } }),
      prisma.template.count({ where }),
    ]);

    return {
      templates: templates.map(formatTemplate),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(organizationId: string, templateId: string): Promise<TemplateResponse> {
    const template = await prisma.template.findFirst({ where: { id: templateId, organizationId } });
    if (!template) throw new AppError('Template not found', 404);
    return formatTemplate(template);
  }

  async update(organizationId: string, templateId: string, input: UpdateTemplateInput): Promise<TemplateResponse> {
    const existing = await prisma.template.findFirst({ where: { id: templateId, organizationId } });
    if (!existing) throw new AppError('Template not found', 404);

    if (existing.status === 'APPROVED' && existing.metaTemplateId) {
      throw new AppError('Cannot modify approved templates. Create a new template instead.', 400);
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

    if (input.bodyText || input.headerContent) updateData.status = 'PENDING';

    const updated = await prisma.template.update({ where: { id: templateId }, data: updateData });
    return formatTemplate(updated);
  }

  async delete(organizationId: string, templateId: string): Promise<{ message: string }> {
    const template = await prisma.template.findFirst({ where: { id: templateId, organizationId } });
    if (!template) throw new AppError('Template not found', 404);

    await prisma.template.delete({ where: { id: templateId } });
    return { message: 'Template deleted successfully' };
  }

  async getStats(organizationId: string): Promise<TemplateStats> {
    const [total, pending, approved, rejected] = await Promise.all([
      prisma.template.count({ where: { organizationId } }),
      prisma.template.count({ where: { organizationId, status: 'PENDING' } }),
      prisma.template.count({ where: { organizationId, status: 'APPROVED' } }),
      prisma.template.count({ where: { organizationId, status: 'REJECTED' } }),
    ]);

    return {
      total,
      pending,
      approved,
      rejected,
      byCategory: {
        marketing: await prisma.template.count({ where: { organizationId, category: 'MARKETING' } }),
        utility: await prisma.template.count({ where: { organizationId, category: 'UTILITY' } }),
        authentication: await prisma.template.count({ where: { organizationId, category: 'AUTHENTICATION' } }),
      },
    };
  }

  async preview(
    bodyText: string,
    variables: Record<string, string> = {},
    headerType?: string,
    headerContent?: string,
    footerText?: string,
    buttons?: TemplateButton[]
  ): Promise<TemplatePreview> {
    const preview: TemplatePreview = { body: replaceVariables(bodyText, variables) };

    if (normalizeHeaderType(headerType) === 'TEXT' && headerContent) {
      preview.header = replaceVariables(headerContent, variables);
    } else if (headerType && normalizeHeaderType(headerType) !== 'NONE') {
      preview.header = `[${headerType}]`;
    }

    if (footerText) preview.footer = footerText;

    if (buttons && buttons.length > 0) {
      preview.buttons = buttons.map((btn) => ({ type: btn.type, text: btn.text }));
    }

    return preview;
  }

  // ==========================================
  // SUBMIT TO META
  // ==========================================
  async submitToMeta(
    organizationId: string,
    templateId: string,
    whatsappAccountId: string
  ): Promise<{ message: string; metaTemplateId?: string }> {
    const template = await prisma.template.findFirst({ where: { id: templateId, organizationId } });
    if (!template) throw new AppError('Template not found', 404);

    const wa = await getConnectedWabaCredentials(organizationId, whatsappAccountId);

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

    const metaRes = await whatsappApi.createMessageTemplate(wa.wabaId, wa.accessToken, metaPayload);
    const metaTemplateId = metaRes?.id || metaRes?.template_id;

    await prisma.template.update({
      where: { id: template.id },
      data: {
        metaTemplateId: metaTemplateId ? String(metaTemplateId) : template.metaTemplateId,
        status: 'PENDING',
        rejectionReason: null,
      },
    });

    return {
      message: 'Template submitted to Meta. It will appear as PENDING until approved.',
      metaTemplateId: metaTemplateId ? String(metaTemplateId) : undefined,
    };
  }

  // ==========================================
  // SYNC FROM META
  // ==========================================
  async syncFromMeta(
    organizationId: string,
    whatsappAccountId?: string
  ): Promise<{ message: string; synced: number }> {
    const wa = await getConnectedWabaCredentials(organizationId, whatsappAccountId);

    const metaTemplates = await whatsappApi.listMessageTemplates(wa.wabaId, wa.accessToken);

    let synced = 0;
    for (const mt of metaTemplates) {
      const metaId = String(mt.id);
      const metaName = String(mt.name);
      const metaLang = String(mt.language);

      const metaStatusRaw = String(mt.status || 'PENDING').toUpperCase();
      const mappedStatus: TemplateStatus =
        metaStatusRaw === 'APPROVED' ? 'APPROVED' : metaStatusRaw === 'REJECTED' ? 'REJECTED' : 'PENDING';

      const local = await prisma.template.findFirst({
        where: {
          organizationId,
          OR: [{ metaTemplateId: metaId }, { name: metaName, language: metaLang }],
        },
      });

      const rejectionReason = mt.rejected_reason || mt.rejection_reason || null;

      if (local) {
        await prisma.template.update({
          where: { id: local.id },
          data: { metaTemplateId: metaId, status: mappedStatus, rejectionReason },
        });
      } else {
        await prisma.template.create({
          data: {
            organizationId,
            name: metaName,
            language: metaLang,
            category: (String(mt.category || 'UTILITY').toUpperCase()) as any,
            bodyText: mt.components?.find((c: any) => c.type === 'BODY')?.text || 'Imported from Meta',
            status: mappedStatus,
            metaTemplateId: metaId,
            buttons: toJsonValue([]),
            variables: toJsonValue([]),
            rejectionReason,
          },
        });
      }

      synced++;
    }

    return { message: 'Templates synced from Meta', synced };
  }

  // ==========================================
  // UPDATE STATUS (Internal)
  // ==========================================
  async updateStatus(metaTemplateId: string, status: TemplateStatus, rejectionReason?: string): Promise<void> {
    await prisma.template.updateMany({
      where: { metaTemplateId },
      data: { status, rejectionReason: rejectionReason || null },
    });
  }
}

export const templatesService = new TemplatesService();