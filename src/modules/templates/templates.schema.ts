// src/modules/templates/templates.schema.ts

import { z } from 'zod';
import { TemplateStatus, TemplateCategory } from '@prisma/client';

// ============================================
// BUTTON SCHEMAS
// ============================================

const quickReplyButtonSchema = z.object({
  type: z.literal('QUICK_REPLY'),
  text: z.string().min(1).max(25, 'Button text max 25 characters'),
});

const urlButtonSchema = z.object({
  type: z.literal('URL'),
  text: z.string().min(1).max(25),
  url: z.string().url('Invalid URL'),
});

const phoneButtonSchema = z.object({
  type: z.literal('PHONE_NUMBER'),
  text: z.string().min(1).max(25),
  phoneNumber: z.string().regex(/^\+[1-9]\d{10,14}$/, 'Invalid phone number'),
});

const buttonSchema = z.discriminatedUnion('type', [
  quickReplyButtonSchema,
  urlButtonSchema,
  phoneButtonSchema,
]);

// Simple button schema for flexible input
const simpleButtonSchema = z.object({
  type: z.enum(['QUICK_REPLY', 'URL', 'PHONE_NUMBER']),
  text: z.string().min(1).max(25, 'Button text max 25 characters'),
  url: z.string().url('Invalid URL').optional(),
  phoneNumber: z.string().optional(),
});

// ============================================
// VARIABLE SCHEMA
// ============================================

const variableSchema = z.object({
  index: z.number().int().min(1).max(10),
  type: z.enum(['text', 'currency', 'date_time', 'image', 'document', 'video']).default('text'),
  example: z.string().optional(),
});

// ============================================
// CREATE TEMPLATE SCHEMA
// ============================================

export const createTemplateSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(1, 'Template name is required')
      .max(512, 'Name is too long')
      .regex(/^[a-z0-9_]+$/, 'Name must be lowercase with underscores only (e.g., order_confirmation)'),
    language: z
      .string()
      .min(2)
      .max(10)
      .default('en'),
    category: z.nativeEnum(TemplateCategory),
    headerType: z.enum(['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT']).optional().default('NONE'),
    headerContent: z.string().max(60, 'Header text max 60 characters').optional().nullable(),
    bodyText: z
      .string()
      .min(1, 'Body text is required')
      .max(1024, 'Body text max 1024 characters'),
    footerText: z.string().max(60, 'Footer text max 60 characters').optional().nullable(),
    buttons: z.array(simpleButtonSchema).max(3, 'Maximum 3 buttons allowed').optional().default([]),
    variables: z.array(variableSchema).max(10, 'Maximum 10 variables').optional().default([]),
    whatsappAccountId: z.string().optional(),  // ✅ Link to specific WhatsApp account
  }),
});

// ============================================
// UPDATE TEMPLATE SCHEMA
// ============================================

export const updateTemplateSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Template ID is required'),
  }),
  body: z.object({
    name: z
      .string()
      .min(1)
      .max(512)
      .regex(/^[a-z0-9_]+$/)
      .optional(),
    language: z.string().min(2).max(10).optional(),
    category: z.nativeEnum(TemplateCategory).optional(),
    headerType: z.enum(['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT']).optional().nullable(),
    headerContent: z.string().max(60).optional().nullable(),
    bodyText: z.string().min(1).max(1024).optional(),
    footerText: z.string().max(60).optional().nullable(),
    buttons: z.array(simpleButtonSchema).max(3).optional(),
    variables: z.array(variableSchema).max(10).optional(),
  }),
});

// ============================================
// GET TEMPLATES LIST SCHEMA
// ============================================

export const getTemplatesSchema = z.object({
  query: z.object({
    page: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .optional()
      .default('1'),
    limit: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .pipe(z.number().min(1).max(100))
      .optional()
      .default('20'),
    search: z.string().optional(),
    status: z.nativeEnum(TemplateStatus).optional(),
    category: z.nativeEnum(TemplateCategory).optional(),
    language: z.string().optional(),
    sortBy: z.enum(['createdAt', 'updatedAt', 'name', 'status']).optional().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
    whatsappAccountId: z.string().optional(),  // ✅ Filter by WhatsApp account
  }),
});

// ============================================
// GET TEMPLATE BY ID SCHEMA
// ============================================

export const getTemplateByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Template ID is required'),
  }),
});

// ============================================
// DELETE TEMPLATE SCHEMA
// ============================================

export const deleteTemplateSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Template ID is required'),
  }),
});

// ============================================
// DUPLICATE TEMPLATE SCHEMA
// ============================================

export const duplicateTemplateSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Template ID is required'),
  }),
  body: z.object({
    name: z
      .string()
      .min(1, 'New name is required')
      .max(512)
      .regex(/^[a-z0-9_]+$/, 'Name must be lowercase with underscores only'),
    whatsappAccountId: z.string().optional(),  // ✅ Target account for duplicate
  }),
});

// ============================================
// SUBMIT TEMPLATE SCHEMA
// ============================================

export const submitTemplateSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Template ID is required'),
  }),
  body: z.object({
    whatsappAccountId: z.string().optional(),  // ✅ Made optional - uses template's linked account
  }).optional(),
});

// ============================================
// PREVIEW TEMPLATE SCHEMA
// ============================================

export const previewTemplateSchema = z.object({
  body: z.object({
    headerType: z.enum(['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT']).optional(),
    headerContent: z.string().optional(),
    bodyText: z.string().min(1, 'Body text is required'),
    footerText: z.string().optional(),
    buttons: z.array(simpleButtonSchema).max(3).optional(),
    variables: z.record(z.string(), z.string()).optional().default({}), // { "1": "John", "2": "Order123" }
  }),
});

// ============================================
// SYNC TEMPLATES SCHEMA
// ============================================

export const syncTemplatesSchema = z.object({
  body: z.object({
    whatsappAccountId: z.string().optional(),  // ✅ Sync from specific account
  }).optional(),
});

// ============================================
// GET APPROVED TEMPLATES SCHEMA
// ============================================

export const getApprovedTemplatesSchema = z.object({
  query: z.object({
    whatsappAccountId: z.string().optional(),  // ✅ Filter by WhatsApp account
  }),
});

// ============================================
// GET LANGUAGES SCHEMA
// ============================================

export const getLanguagesSchema = z.object({
  query: z.object({
    whatsappAccountId: z.string().optional(),  // ✅ Filter by WhatsApp account
  }),
});

// ============================================
// GET STATS SCHEMA
// ============================================

export const getStatsSchema = z.object({
  query: z.object({
    whatsappAccountId: z.string().optional(),  // ✅ Filter by WhatsApp account
  }),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>['body'];
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>['body'];
export type GetTemplatesInput = z.infer<typeof getTemplatesSchema>['query'];
export type DuplicateTemplateInput = z.infer<typeof duplicateTemplateSchema>['body'];
export type SubmitTemplateInput = z.infer<typeof submitTemplateSchema>;
export type PreviewTemplateInput = z.infer<typeof previewTemplateSchema>['body'];
export type SyncTemplatesInput = z.infer<typeof syncTemplatesSchema>;

// Button types
export type TemplateButton = z.infer<typeof simpleButtonSchema>;
export type TemplateVariable = z.infer<typeof variableSchema>;

// Legacy type exports for backward compatibility
export type CreateTemplateSchema = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateSchema = z.infer<typeof updateTemplateSchema>;
export type GetTemplatesSchema = z.infer<typeof getTemplatesSchema>;
export type DuplicateTemplateSchema = z.infer<typeof duplicateTemplateSchema>;
export type SubmitTemplateSchema = z.infer<typeof submitTemplateSchema>;
export type PreviewTemplateSchema = z.infer<typeof previewTemplateSchema>;