"use strict";
// src/modules/contacts/contacts.schema.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteContactGroupSchema = exports.removeContactsFromGroupSchema = exports.addContactsToGroupSchema = exports.updateContactGroupSchema = exports.createContactGroupSchema = exports.bulkDeleteContactsSchema = exports.bulkUpdateContactsSchema = exports.importContactsSchema = exports.deleteContactSchema = exports.getContactByIdSchema = exports.getContactsSchema = exports.updateContactSchema = exports.createContactSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
// ============================================
// VALIDATORS
// ============================================
const phoneSchema = zod_1.z
    .string()
    .min(10, 'Phone number must be at least 10 digits')
    .max(15, 'Phone number is too long')
    .regex(/^[0-9]+$/, 'Phone number must contain only digits');
const countryCodeSchema = zod_1.z
    .string()
    .regex(/^\+[1-9]\d{0,3}$/, 'Invalid country code (e.g., +91)')
    .default('+91');
const emailSchema = zod_1.z
    .string()
    .email('Invalid email address')
    .optional()
    .nullable();
const nameSchema = zod_1.z
    .string()
    .max(50, 'Name is too long')
    .optional()
    .nullable();
const tagsSchema = zod_1.z
    .array(zod_1.z.string().max(30))
    .max(20, 'Maximum 20 tags allowed')
    .optional()
    .default([]);
const colorSchema = zod_1.z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format')
    .optional();
// ============================================
// REQUEST SCHEMAS
// ============================================
exports.createContactSchema = zod_1.z.object({
    body: zod_1.z.object({
        phone: phoneSchema,
        countryCode: countryCodeSchema,
        firstName: nameSchema,
        lastName: nameSchema,
        email: emailSchema,
        tags: tagsSchema,
        customFields: zod_1.z.record(zod_1.z.any()).optional().default({}),
        groupIds: zod_1.z.array(zod_1.z.string()).optional().default([]),
    }),
});
exports.updateContactSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Contact ID is required'),
    }),
    body: zod_1.z.object({
        phone: phoneSchema.optional(),
        countryCode: countryCodeSchema.optional(),
        firstName: nameSchema,
        lastName: nameSchema,
        email: emailSchema,
        tags: tagsSchema,
        customFields: zod_1.z.record(zod_1.z.any()).optional(),
        status: zod_1.z.nativeEnum(client_1.ContactStatus).optional(),
    }),
});
exports.getContactsSchema = zod_1.z.object({
    query: zod_1.z.object({
        page: zod_1.z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
        limit: zod_1.z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
        search: zod_1.z.string().optional(),
        status: zod_1.z.nativeEnum(client_1.ContactStatus).optional(),
        tags: zod_1.z.string().optional(), // comma-separated
        groupId: zod_1.z.string().optional(),
        sortBy: zod_1.z.enum(['createdAt', 'firstName', 'lastName', 'lastMessageAt']).optional().default('createdAt'),
        sortOrder: zod_1.z.enum(['asc', 'desc']).optional().default('desc'),
    }),
});
exports.getContactByIdSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Contact ID is required'),
    }),
});
exports.deleteContactSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Contact ID is required'),
    }),
});
exports.importContactsSchema = zod_1.z.object({
    body: zod_1.z.object({
        contacts: zod_1.z.array(zod_1.z.object({
            phone: phoneSchema,
            countryCode: countryCodeSchema.optional(),
            firstName: nameSchema,
            lastName: nameSchema,
            email: emailSchema,
            tags: tagsSchema,
            customFields: zod_1.z.record(zod_1.z.any()).optional(),
        })).min(1, 'At least one contact is required').max(10000, 'Maximum 10000 contacts per import'),
        groupId: zod_1.z.string().optional(),
        tags: tagsSchema,
        skipDuplicates: zod_1.z.boolean().optional().default(true),
    }),
});
exports.bulkUpdateContactsSchema = zod_1.z.object({
    body: zod_1.z.object({
        contactIds: zod_1.z.array(zod_1.z.string()).min(1, 'At least one contact ID is required'),
        tags: tagsSchema.optional(),
        groupIds: zod_1.z.array(zod_1.z.string()).optional(),
        status: zod_1.z.nativeEnum(client_1.ContactStatus).optional(),
    }),
});
exports.bulkDeleteContactsSchema = zod_1.z.object({
    body: zod_1.z.object({
        contactIds: zod_1.z.array(zod_1.z.string()).min(1, 'At least one contact ID is required'),
    }),
});
// Contact Groups Schemas
exports.createContactGroupSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1, 'Group name is required').max(50, 'Group name is too long'),
        description: zod_1.z.string().max(200, 'Description is too long').optional(),
        color: colorSchema,
    }),
});
exports.updateContactGroupSchema = zod_1.z.object({
    params: zod_1.z.object({
        groupId: zod_1.z.string().min(1, 'Group ID is required'),
    }),
    body: zod_1.z.object({
        name: zod_1.z.string().min(1).max(50).optional(),
        description: zod_1.z.string().max(200).optional().nullable(),
        color: colorSchema,
    }),
});
exports.addContactsToGroupSchema = zod_1.z.object({
    params: zod_1.z.object({
        groupId: zod_1.z.string().min(1, 'Group ID is required'),
    }),
    body: zod_1.z.object({
        contactIds: zod_1.z.array(zod_1.z.string()).min(1, 'At least one contact ID is required'),
    }),
});
exports.removeContactsFromGroupSchema = zod_1.z.object({
    params: zod_1.z.object({
        groupId: zod_1.z.string().min(1, 'Group ID is required'),
    }),
    body: zod_1.z.object({
        contactIds: zod_1.z.array(zod_1.z.string()).min(1, 'At least one contact ID is required'),
    }),
});
exports.deleteContactGroupSchema = zod_1.z.object({
    params: zod_1.z.object({
        groupId: zod_1.z.string().min(1, 'Group ID is required'),
    }),
});
//# sourceMappingURL=contacts.schema.js.map