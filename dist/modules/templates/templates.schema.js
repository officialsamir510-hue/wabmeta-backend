"use strict";
// src/modules/templates/templates.schema.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.previewTemplateSchema = exports.submitTemplateSchema = exports.duplicateTemplateSchema = exports.deleteTemplateSchema = exports.getTemplateByIdSchema = exports.getTemplatesSchema = exports.updateTemplateSchema = exports.createTemplateSchema = void 0;
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
const buttonSchema = zod_1.z.discriminatedUnion('type', [
    quickReplyButtonSchema,
    urlButtonSchema,
    phoneButtonSchema,
]);
// ============================================
// VARIABLE SCHEMA
// ============================================
const variableSchema = zod_1.z.object({
    index: zod_1.z.number().int().min(1).max(10),
    type: zod_1.z.enum(['text', 'currency', 'date_time', 'image', 'document', 'video']),
    example: zod_1.z.string().optional(),
});
// ============================================
// REQUEST SCHEMAS
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
        headerContent: zod_1.z.string().max(60, 'Header text max 60 characters').optional(),
        bodyText: zod_1.z
            .string()
            .min(1, 'Body text is required')
            .max(1024, 'Body text max 1024 characters'),
        footerText: zod_1.z.string().max(60, 'Footer text max 60 characters').optional(),
        buttons: zod_1.z.array(buttonSchema).max(3, 'Maximum 3 buttons allowed').optional().default([]),
        variables: zod_1.z.array(variableSchema).max(10, 'Maximum 10 variables').optional().default([]),
    }),
});
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
        headerType: zod_1.z.enum(['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT']).optional(),
        headerContent: zod_1.z.string().max(60).optional().nullable(),
        bodyText: zod_1.z.string().min(1).max(1024).optional(),
        footerText: zod_1.z.string().max(60).optional().nullable(),
        buttons: zod_1.z.array(buttonSchema).max(3).optional(),
        variables: zod_1.z.array(variableSchema).max(10).optional(),
    }),
});
exports.getTemplatesSchema = zod_1.z.object({
    query: zod_1.z.object({
        page: zod_1.z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
        limit: zod_1.z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
        search: zod_1.z.string().optional(),
        status: zod_1.z.nativeEnum(client_1.TemplateStatus).optional(),
        category: zod_1.z.nativeEnum(client_1.TemplateCategory).optional(),
        language: zod_1.z.string().optional(),
        sortBy: zod_1.z.enum(['createdAt', 'name', 'status']).optional().default('createdAt'),
        sortOrder: zod_1.z.enum(['asc', 'desc']).optional().default('desc'),
    }),
});
exports.getTemplateByIdSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Template ID is required'),
    }),
});
exports.deleteTemplateSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Template ID is required'),
    }),
});
exports.duplicateTemplateSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Template ID is required'),
    }),
    body: zod_1.z.object({
        name: zod_1.z
            .string()
            .min(1)
            .max(512)
            .regex(/^[a-z0-9_]+$/, 'Name must be lowercase with underscores only'),
    }),
});
exports.submitTemplateSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Template ID is required'),
    }),
    body: zod_1.z.object({
        whatsappAccountId: zod_1.z.string().min(1, 'WhatsApp account ID is required'),
    }),
});
exports.previewTemplateSchema = zod_1.z.object({
    body: zod_1.z.object({
        headerType: zod_1.z.enum(['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT']).optional(),
        headerContent: zod_1.z.string().optional(),
        bodyText: zod_1.z.string().min(1),
        footerText: zod_1.z.string().optional(),
        buttons: zod_1.z.array(buttonSchema).optional(),
        variables: zod_1.z.record(zod_1.z.string()).optional(), // { "1": "John", "2": "Order123" }
    }),
});
//# sourceMappingURL=templates.schema.js.map