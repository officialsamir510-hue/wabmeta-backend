"use strict";
// src/modules/contacts/contacts.schema.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.addContactsToGroupSchema = exports.updateContactGroupSchema = exports.createContactGroupSchema = exports.bulkDeleteSchema = exports.bulkUpdateSchema = exports.importContactsSchema = exports.updateContactSchema = exports.createContactSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
// Indian phone number validation regex
const indianPhoneRegex = /^(\+91|91)?[6-9]\d{9}$/;
// Phone schema with validation and normalization
const phoneSchema = zod_1.z.string()
    .min(10, 'Phone number must be at least 10 digits')
    .regex(indianPhoneRegex, 'Only Indian phone numbers (+91) starting with 6-9 are allowed')
    .transform(phone => {
    // Normalize to 10-digit format
    let cleaned = phone.replace(/[\s\-\(\)]/g, '');
    if (cleaned.startsWith('+91')) {
        return cleaned.substring(3);
    }
    else if (cleaned.startsWith('91')) {
        return cleaned.substring(2);
    }
    return cleaned;
});
// ============================================
// CONTACT SCHEMAS
// ============================================
exports.createContactSchema = zod_1.z.object({
    body: zod_1.z.object({
        phone: phoneSchema,
        countryCode: zod_1.z.string().optional().default('+91'),
        firstName: zod_1.z.string().optional(),
        lastName: zod_1.z.string().optional(),
        email: zod_1.z.string().email().optional().or(zod_1.z.literal('')),
        tags: zod_1.z.array(zod_1.z.string()).optional().default([]),
        customFields: zod_1.z.record(zod_1.z.any()).optional().default({}),
        groupIds: zod_1.z.array(zod_1.z.string()).optional(),
    }),
});
exports.updateContactSchema = zod_1.z.object({
    body: zod_1.z.object({
        phone: phoneSchema.optional(),
        countryCode: zod_1.z.string().optional(),
        firstName: zod_1.z.string().optional(),
        lastName: zod_1.z.string().optional(),
        email: zod_1.z.string().email().optional().or(zod_1.z.literal('')),
        tags: zod_1.z.array(zod_1.z.string()).optional(),
        customFields: zod_1.z.record(zod_1.z.any()).optional(),
        status: zod_1.z.nativeEnum(client_1.ContactStatus).optional(),
    }),
});
exports.importContactsSchema = zod_1.z.object({
    body: zod_1.z.object({
        contacts: zod_1.z.array(zod_1.z.object({
            phone: zod_1.z.string().regex(indianPhoneRegex, 'Invalid Indian phone number'),
            firstName: zod_1.z.string().optional(),
            lastName: zod_1.z.string().optional(),
            email: zod_1.z.string().email().optional().or(zod_1.z.literal('')),
            tags: zod_1.z.array(zod_1.z.string()).optional(),
            customFields: zod_1.z.record(zod_1.z.any()).optional(),
        })).min(1, 'At least one contact is required'),
        groupId: zod_1.z.string().optional(),
        tags: zod_1.z.array(zod_1.z.string()).optional(),
        skipDuplicates: zod_1.z.boolean().optional().default(true),
    }),
});
exports.bulkUpdateSchema = zod_1.z.object({
    body: zod_1.z.object({
        contactIds: zod_1.z.array(zod_1.z.string()).min(1, 'At least one contact ID is required'),
        tags: zod_1.z.array(zod_1.z.string()).optional(),
        groupIds: zod_1.z.array(zod_1.z.string()).optional(),
        status: zod_1.z.nativeEnum(client_1.ContactStatus).optional(),
    }),
});
exports.bulkDeleteSchema = zod_1.z.object({
    body: zod_1.z.object({
        contactIds: zod_1.z.array(zod_1.z.string()).min(1, 'At least one contact ID is required'),
    }),
});
// ============================================
// CONTACT GROUP SCHEMAS
// ============================================
exports.createContactGroupSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1, 'Group name is required'),
        description: zod_1.z.string().optional(),
        color: zod_1.z.string().optional(),
    }),
});
exports.updateContactGroupSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1).optional(),
        description: zod_1.z.string().optional(),
        color: zod_1.z.string().optional(),
    }),
});
exports.addContactsToGroupSchema = zod_1.z.object({
    body: zod_1.z.object({
        contactIds: zod_1.z.array(zod_1.z.string()).min(1, 'At least one contact ID is required'),
    }),
});
//# sourceMappingURL=contacts.schema.js.map