"use strict";
// src/modules/templates/templates.schema.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStatsSchema = exports.getLanguagesSchema = exports.getApprovedTemplatesSchema = exports.syncTemplatesSchema = exports.previewTemplateSchema = exports.submitTemplateSchema = exports.duplicateTemplateSchema = exports.deleteTemplateSchema = exports.getTemplateByIdSchema = exports.getTemplatesSchema = exports.updateTemplateSchema = exports.createTemplateSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
// ============================================
// BUTTON SCHEMAS
// ============================================
const quickReplyButtonSchema = zod_1.z.object({
    type: zod_1.z.literal('QUICK_REPLY'),
    text: zod_1.z.string().min(1).max(25, 'Button text max 25 characters'),
});
const urlButtonSchema = zod_1.z.object({
    type: zod_1.z.literal('URL'),
    text: zod_1.z.string().min(1).max(25),
    url: zod_1.z.string().url('Invalid URL'),
});
const phoneButtonSchema = zod_1.z.object({
    type: zod_1.z.literal('PHONE_NUMBER'),
    text: zod_1.z.string().min(1).max(25),
    phoneNumber: zod_1.z.string().regex(/^\+[1-9]\d{10,14}$/, 'Invalid phone number'),
});
// Flexible button schema for easy input
const simpleButtonSchema = zod_1.z.object({
    type: zod_1.z.enum(['QUICK_REPLY', 'URL', 'PHONE_NUMBER']),
    text: zod_1.z.string().min(1).max(25, 'Button text max 25 characters'),
    url: zod_1.z.string().url('Invalid URL').optional(),
    phoneNumber: zod_1.z.string().optional(),
});
// ============================================
// VARIABLE SCHEMA
// ============================================
const variableSchema = zod_1.z.object({
    index: zod_1.z.number().int().min(1).max(10),
    type: zod_1.z.enum(['text', 'currency', 'date_time', 'image', 'document', 'video']).default('text'),
    example: zod_1.z.string().optional(),
    placeholder: zod_1.z.string().optional(),
});
// ============================================
// CREATE TEMPLATE SCHEMA
// ============================================
exports.createTemplateSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z
            .string()
            .min(1, 'Template name is required')
            .max(512, 'Name is too long')
            .regex(/^[a-z0-9_]+$/, 'Name must be lowercase with underscores only (e.g., order_confirmation)'),
        language: zod_1.z
            .string()
            .min(2)
            .max(10)
            .default('en'),
        category: zod_1.z.nativeEnum(client_1.TemplateCategory),
        headerType: zod_1.z.enum(['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT']).optional().default('NONE'),
        headerContent: zod_1.z.string().max(60, 'Header text max 60 characters').optional().nullable(),
        bodyText: zod_1.z
            .string()
            .min(1, 'Body text is required')
            .max(1024, 'Body text max 1024 characters'),
        footerText: zod_1.z.string().max(60, 'Footer text max 60 characters').optional().nullable(),
        buttons: zod_1.z.array(simpleButtonSchema).max(3, 'Maximum 3 buttons allowed').optional().default([]),
        variables: zod_1.z.array(variableSchema).max(10, 'Maximum 10 variables').optional().default([]),
        whatsappAccountId: zod_1.z.string().optional(),
    }),
});
// ============================================
// UPDATE TEMPLATE SCHEMA
// ============================================
exports.updateTemplateSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Template ID is required'),
    }),
    body: zod_1.z.object({
        name: zod_1.z
            .string()
            .min(1)
            .max(512)
            .regex(/^[a-z0-9_]+$/)
            .optional(),
        language: zod_1.z.string().min(2).max(10).optional(),
        category: zod_1.z.nativeEnum(client_1.TemplateCategory).optional(),
        headerType: zod_1.z.enum(['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT']).optional().nullable(),
        headerContent: zod_1.z.string().max(60).optional().nullable(),
        bodyText: zod_1.z.string().min(1).max(1024).optional(),
        footerText: zod_1.z.string().max(60).optional().nullable(),
        buttons: zod_1.z.array(simpleButtonSchema).max(3).optional(),
        variables: zod_1.z.array(variableSchema).max(10).optional(),
    }),
});
// ============================================
// GET TEMPLATES LIST SCHEMA - FIXED
// ============================================
exports.getTemplatesSchema = zod_1.z.object({
    query: zod_1.z.object({
        page: zod_1.z
            .string()
            .optional()
            .default('1')
            .transform(val => {
            const num = parseInt(val);
            return isNaN(num) || num < 1 ? 1 : num;
        }),
        limit: zod_1.z
            .string()
            .optional()
            .default('20')
            .transform(val => {
            const num = parseInt(val);
            return isNaN(num) || num < 1 ? 20 : Math.min(num, 100);
        }),
        search: zod_1.z.string().optional().transform(val => val?.trim() || undefined),
        status: zod_1.z.nativeEnum(client_1.TemplateStatus).optional(),
        category: zod_1.z.nativeEnum(client_1.TemplateCategory).optional(),
        language: zod_1.z.string().optional().transform(val => val?.trim() || undefined),
        sortBy: zod_1.z.enum(['createdAt', 'updatedAt', 'name', 'status']).optional().default('createdAt'),
        sortOrder: zod_1.z.enum(['asc', 'desc']).optional().default('desc'),
        whatsappAccountId: zod_1.z.string().optional().transform(val => val?.trim() || undefined),
    }).passthrough(), // ✅ Allow additional unknown query params
});
// ============================================
// GET TEMPLATE BY ID SCHEMA
// ============================================
exports.getTemplateByIdSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Template ID is required'),
    }),
});
// ============================================
// DELETE TEMPLATE SCHEMA
// ============================================
exports.deleteTemplateSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Template ID is required'),
    }),
});
// ============================================
// DUPLICATE TEMPLATE SCHEMA
// ============================================
exports.duplicateTemplateSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Template ID is required'),
    }),
    body: zod_1.z.object({
        name: zod_1.z
            .string()
            .min(1, 'New name is required')
            .max(512)
            .regex(/^[a-z0-9_]+$/, 'Name must be lowercase with underscores only'),
        whatsappAccountId: zod_1.z.string().optional(),
    }),
});
// ============================================
// SUBMIT TEMPLATE SCHEMA
// ============================================
exports.submitTemplateSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Template ID is required'),
    }),
    body: zod_1.z.object({
        whatsappAccountId: zod_1.z.string().optional(),
    }).optional(),
});
// ============================================
// PREVIEW TEMPLATE SCHEMA
// ============================================
exports.previewTemplateSchema = zod_1.z.object({
    body: zod_1.z.object({
        headerType: zod_1.z.enum(['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT']).optional(),
        headerContent: zod_1.z.string().optional(),
        bodyText: zod_1.z.string().min(1, 'Body text is required'),
        footerText: zod_1.z.string().optional(),
        buttons: zod_1.z.array(simpleButtonSchema).max(3).optional(),
        variables: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional().default({}),
    }),
});
// ============================================
// SYNC TEMPLATES SCHEMA - FIXED
// ============================================
exports.syncTemplatesSchema = zod_1.z.object({
    body: zod_1.z.object({
        whatsappAccountId: zod_1.z.string().optional(),
    }).optional().default({}),
});
// ============================================
// GET APPROVED TEMPLATES SCHEMA - FIXED
// ============================================
exports.getApprovedTemplatesSchema = zod_1.z.object({
    query: zod_1.z.object({
        whatsappAccountId: zod_1.z.string().optional().transform(val => val?.trim() || undefined),
    }).passthrough(),
});
// ============================================
// GET LANGUAGES SCHEMA - FIXED
// ============================================
exports.getLanguagesSchema = zod_1.z.object({
    query: zod_1.z.object({
        whatsappAccountId: zod_1.z.string().optional().transform(val => val?.trim() || undefined),
    }).passthrough(),
});
// ============================================
// GET STATS SCHEMA - FIXED
// ============================================
exports.getStatsSchema = zod_1.z.object({
    query: zod_1.z.object({
        whatsappAccountId: zod_1.z.string().optional().transform(val => val?.trim() || undefined),
    }).passthrough(),
});
//# sourceMappingURL=templates.schema.js.map