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

const extractVariables = (text: string): number[] => {
  const regex = /\{\{(\d+)\}\}/g;
  const variables: number[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) variables.push(parseInt(match[1], 10));
  return [...new Set(variables)].sort((a, b) => a - b);
};

const replaceVariables = (text: string, values: Record<string, string>): string => {
  return text.replace(/\{\{(\d+)\}\}/g, (match, index) => values[index] || match);
};

const toJsonValue = (value: any): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));

const toMetaLanguage = (lang: string) => {
  // Meta expects like en_US, hi_IN etc.
  if (!lang) return 'en_US';
  if (lang.includes('_')) return lang;
  if (lang === 'en') return 'en_US';
  if (lang === 'hi') return 'hi_IN';
  return 'en_US';
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

  // HEADER (only TEXT fully supported; media header needs header_handle example)
  if (t.headerType && t.headerType !== 'NONE') {
    if (t.headerType === 'TEXT' && t.headerContent) {
      const headerVars = extractVariables(t.headerContent);
      const headerComp: any = { type: 'HEADER', format: 'TEXT', text: t.headerContent };

      if (headerVars.length > 0) {
        headerComp.example = {
          header_text: headerVars.map((i) => `Example${i}`),
        };
      }
      components.push(headerComp);
    } else {
      // If you want media headers, you must upload media & use header_handle example.
      throw new AppError(
        `HeaderType ${t.headerType} needs media upload + header_handle example. Use TEXT header for now.`,
        400
      );
    }
  }

  // BODY
  const bodyVars = extractVariables(t.bodyText);
  const bodyComp: any = { type: 'BODY', text: t.bodyText };

  if (bodyVars.length > 0) {
    bodyComp.example = {
      body_text: [bodyVars.map((i) => `Example${i}`)],
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

      // default quick reply
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

const getDefaultConnectedWaAccount = async (organizationId: string) => {
  const wa = await prisma.whatsAppAccount.findFirst({
    where: {
      organizationId,
      status: 'CONNECTED',
      isDefault: true,
    },
  });

  if (!wa) throw new AppError('WhatsApp account not connected. Connect WhatsApp first.', 400);
  if (!wa.wabaId) throw new AppError('WABA ID missing on WhatsApp account.', 400);
  if (!wa.accessToken) throw new AppError('Access token missing on WhatsApp account.', 400);

  return wa;
};

// ============================================
// SERVICE
// ============================================

export class TemplatesService {
  // CREATE TEMPLATE (✅ creates on Meta too)
  async create(organizationId: string, input: CreateTemplateInput): Promise<TemplateResponse> {
    const { name, language, category, headerType, headerContent, bodyText, footerText, buttons, variables } =
      input;

    const existing = await prisma.template.findUnique({
      where: {
        organizationId_name_language: { organizationId, name, language },
      },
    });
    if (existing) throw new AppError('Template with this name and language already exists', 409);

    // Auto-extract variables
    const extractedVars = extractVariables(bodyText);
    const finalVariables =
      variables && variables.length > 0
        ? variables
        : extractedVars.map((index) => ({ index, type: 'text' as const }));

    // ✅ Require WhatsApp connected to push template to Meta
    const wa = await getDefaultConnectedWaAccount(organizationId);

    // 1) Create locally first
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
      },
    });

    // 2) Create on Meta (WABA)
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

      const metaRes = await whatsappApi.createMessageTemplate(wa.wabaId, wa.accessToken, metaPayload);

      const metaTemplateId = metaRes?.id || metaRes?.template_id;

      await prisma.template.update({
        where: { id: template.id },
        data: {
          metaTemplateId: metaTemplateId ? String(metaTemplateId) : null,
          status: 'PENDING',
        },
      });

      console.log('✅ Meta template created:', { metaTemplateId, name });
    } catch (e: any) {
      console.error('❌ Meta template create failed:', e?.response?.data || e);
      // Keep local template; user can retry sync/submit later
    }

    const latest = await prisma.template.findUnique({ where: { id: template.id } });
    return formatTemplate(latest);
  }

  // LIST
  async getList(organizationId: string, query: TemplatesQueryInput): Promise<TemplatesListResponse> {
    const { page = 1, limit = 20, search, status, category, language, sortBy = 'createdAt', sortOrder = 'desc' } = query;

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
      const extractedVars = extractVariables(input.bodyText);
      if (!finalVariables || finalVariables.length === 0) {
        finalVariables = extractedVars.map((index) => ({ index, type: 'text' as const }));
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

    const template = await prisma.template.update({ where: { id: templateId }, data: updateData });
    return formatTemplate(template);
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

    if (headerType === 'TEXT' && headerContent) preview.header = replaceVariables(headerContent, variables);
    else if (headerType && headerType !== 'NONE') preview.header = `[${headerType}]`;

    if (footerText) preview.footer = footerText;

    if (buttons && buttons.length > 0) {
      preview.buttons = buttons.map((btn) => ({ type: btn.type, text: btn.text }));
    }

    return preview;
  }

  // ✅ Sync from Meta: updates status/metaTemplateId
  async syncFromMeta(organizationId: string): Promise<{ message: string; synced: number }> {
    const wa = await getDefaultConnectedWaAccount(organizationId);

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
        where: { organizationId, OR: [{ metaTemplateId: metaId }, { name: metaName, language: metaLang }] },
      });

      if (local) {
        await prisma.template.update({
          where: { id: local.id },
          data: { metaTemplateId: metaId, status: mappedStatus, rejectionReason: mt.rejected_reason || null },
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
          },
        });
      }

      synced++;
    }

    return { message: 'Templates synced from Meta', synced };
  }
}

export const templatesService = new TemplatesService();