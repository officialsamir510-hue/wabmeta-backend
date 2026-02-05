// src/modules/templates/templates.service.ts

import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { TemplateStatus, TemplateCategory, Prisma } from '@prisma/client';
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

// ============================================
// HELPER FUNCTIONS
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

// Replace variables with values
const replaceVariables = (text: string, values: Record<string, string>): string => {
  return text.replace(/\{\{(\d+)\}\}/g, (match, index) => {
    return values[index] || match;
  });
};

// Convert to Prisma JSON compatible format
const toJsonValue = (value: any): Prisma.InputJsonValue => {
  return JSON.parse(JSON.stringify(value));
};

// ============================================
// TEMPLATES SERVICE CLASS
// ============================================

export class TemplatesService {
  // ==========================================
  // CREATE TEMPLATE
  // ==========================================
  async create(organizationId: string, input: CreateTemplateInput): Promise<TemplateResponse> {
    const { name, language, category, headerType, headerContent, bodyText, footerText, buttons, variables } = input;

    // Check for duplicate name + language
    const existing = await prisma.template.findUnique({
      where: {
        organizationId_name_language: {
          organizationId,
          name,
          language,
        },
      },
    });

    if (existing) {
      throw new AppError('Template with this name and language already exists', 409);
    }

    // Check organization limits
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        subscription: {
          include: { plan: true },
        },
        _count: {
          select: { templates: true },
        },
      },
    });

    if (org?.subscription?.plan) {
      if (org._count.templates >= org.subscription.plan.maxTemplates) {
        throw new AppError('Template limit reached. Please upgrade your plan.', 400);
      }
    }

    // Auto-extract variables if not provided
    const extractedVars = extractVariables(bodyText);
    const finalVariables = variables && variables.length > 0
      ? variables
      : extractedVars.map((index) => ({ index, type: 'text' as const }));

    // Create template
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

    return formatTemplate(template);
  }

  // ==========================================
  // GET TEMPLATES LIST
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

    // Build where clause
    const where: Prisma.TemplateWhereInput = {
      organizationId,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { bodyText: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (category) {
      where.category = category;
    }

    if (language) {
      where.language = language;
    }

    // Execute query
    const [templates, total] = await Promise.all([
      prisma.template.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.template.count({ where }),
    ]);

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

  // ==========================================
  // GET TEMPLATE BY ID
  // ==========================================
  async getById(organizationId: string, templateId: string): Promise<TemplateResponse> {
    const template = await prisma.template.findFirst({
      where: {
        id: templateId,
        organizationId,
      },
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
    // Check template exists
    const existing = await prisma.template.findFirst({
      where: {
        id: templateId,
        organizationId,
      },
    });

    if (!existing) {
      throw new AppError('Template not found', 404);
    }

    // Cannot update approved templates (need to create new version)
    if (existing.status === 'APPROVED' && existing.metaTemplateId) {
      throw new AppError('Cannot modify approved templates. Create a new template instead.', 400);
    }

    // Check for duplicate name if name is being changed
    if (input.name && input.name !== existing.name) {
      const duplicate = await prisma.template.findFirst({
        where: {
          organizationId,
          name: input.name,
          language: input.language || existing.language,
          id: { not: templateId },
        },
      });

      if (duplicate) {
        throw new AppError('Template with this name and language already exists', 409);
      }
    }

    // Auto-extract variables from new body text
    let finalVariables = input.variables;
    if (input.bodyText) {
      const extractedVars = extractVariables(input.bodyText);
      if (!finalVariables || finalVariables.length === 0) {
        finalVariables = extractedVars.map((index) => ({ index, type: 'text' as const }));
      }
    }

    // Build update data
    const updateData: Prisma.TemplateUpdateInput = {
      name: input.name,
      language: input.language,
      category: input.category,
      headerType: input.headerType,
      headerContent: input.headerContent,
      bodyText: input.bodyText,
      footerText: input.footerText,
    };

    // Add buttons if provided
    if (input.buttons !== undefined) {
      updateData.buttons = toJsonValue(input.buttons);
    }

    // Add variables if provided
    if (finalVariables !== undefined) {
      updateData.variables = toJsonValue(finalVariables);
    }

    // Reset status to pending if content changed
    if (input.bodyText || input.headerContent) {
      updateData.status = 'PENDING';
    }

    // Update template
    const template = await prisma.template.update({
      where: { id: templateId },
      data: updateData,
    });

    return formatTemplate(template);
  }

  // ==========================================
  // DELETE TEMPLATE
  // ==========================================
  async delete(organizationId: string, templateId: string): Promise<{ message: string }> {
    const template = await prisma.template.findFirst({
      where: {
        id: templateId,
        organizationId,
      },
    });

    if (!template) {
      throw new AppError('Template not found', 404);
    }

    await prisma.template.delete({
      where: { id: templateId },
    });

    return { message: 'Template deleted successfully' };
  }

  // ==========================================
  // DUPLICATE TEMPLATE
  // ==========================================
  async duplicate(
    organizationId: string,
    templateId: string,
    newName: string
  ): Promise<TemplateResponse> {
    const original = await prisma.template.findFirst({
      where: {
        id: templateId,
        organizationId,
      },
    });

    if (!original) {
      throw new AppError('Template not found', 404);
    }

    // Check for duplicate name
    const existing = await prisma.template.findUnique({
      where: {
        organizationId_name_language: {
          organizationId,
          name: newName,
          language: original.language,
        },
      },
    });

    if (existing) {
      throw new AppError('Template with this name already exists', 409);
    }

    // Create duplicate
    const duplicate = await prisma.template.create({
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
      },
    });

    return formatTemplate(duplicate);
  }

  // ==========================================
  // GET TEMPLATE STATS
  // ==========================================
  async getStats(organizationId: string): Promise<TemplateStats> {
    const [total, pending, approved, rejected, marketing, utility, authentication] = await Promise.all([
      prisma.template.count({ where: { organizationId } }),
      prisma.template.count({ where: { organizationId, status: 'PENDING' } }),
      prisma.template.count({ where: { organizationId, status: 'APPROVED' } }),
      prisma.template.count({ where: { organizationId, status: 'REJECTED' } }),
      prisma.template.count({ where: { organizationId, category: 'MARKETING' } }),
      prisma.template.count({ where: { organizationId, category: 'UTILITY' } }),
      prisma.template.count({ where: { organizationId, category: 'AUTHENTICATION' } }),
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
      body: replaceVariables(bodyText, variables),
    };

    if (headerType === 'TEXT' && headerContent) {
      preview.header = replaceVariables(headerContent, variables);
    } else if (headerType && headerType !== 'NONE') {
      preview.header = `[${headerType}]`;
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

  // ==========================================
  // GET APPROVED TEMPLATES (for campaigns)
  // ==========================================
  async getApprovedTemplates(organizationId: string): Promise<TemplateResponse[]> {
    const templates = await prisma.template.findMany({
      where: {
        organizationId,
        status: 'APPROVED',
      },
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

    return templates.map((t) => ({
      language: t.language,
      count: t._count.language,
    }));
  }

  // ==========================================
  // SUBMIT TO META (Placeholder)
  // ==========================================
  async submitToMeta(
    organizationId: string,
    templateId: string,
    whatsappAccountId: string
  ): Promise<{ message: string; metaTemplateId?: string }> {
    const template = await prisma.template.findFirst({
      where: {
        id: templateId,
        organizationId,
      },
    });

    if (!template) {
      throw new AppError('Template not found', 404);
    }

    const waAccount = await prisma.whatsAppAccount.findFirst({
      where: {
        id: whatsappAccountId,
        organizationId,
      },
    });

    if (!waAccount) {
      throw new AppError('WhatsApp account not found', 404);
    }

    // TODO: Implement actual Meta API call
    await prisma.template.update({
      where: { id: templateId },
      data: { status: 'PENDING' },
    });

    return {
      message: 'Template submitted for approval. This may take up to 24 hours.',
    };
  }

  // ==========================================
  // SYNC FROM META (Placeholder)
  // ==========================================
  async syncFromMeta(
    organizationId: string,
    whatsappAccountId: string
  ): Promise<{ message: string; synced: number }> {
    const waAccount = await prisma.whatsAppAccount.findFirst({
      where: {
        id: whatsappAccountId,
        organizationId,
      },
    });

    if (!waAccount) {
      throw new AppError('WhatsApp account not found', 404);
    }

    return {
      message: 'Templates synced successfully',
      synced: 0,
    };
  }

  // ==========================================
  // UPDATE STATUS (Internal)
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
        rejectionReason: rejectionReason || null,
      },
    });
  }

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

    if (input.headerType === 'TEXT' && input.headerContent && input.headerContent.length > 60) {
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

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Export singleton instance
export const templatesService = new TemplatesService();