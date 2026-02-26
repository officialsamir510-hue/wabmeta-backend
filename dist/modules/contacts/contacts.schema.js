"use strict";
// src/modules/contacts/contacts.schema.ts - COMPLETE FIXED
Object.defineProperty(exports, "__esModule", { value: true });
exports.addContactsToGroupSchema = exports.updateContactGroupSchema = exports.createContactGroupSchema = exports.bulkDeleteSchema = exports.bulkUpdateSchema = exports.importContactsSchema = exports.updateContactSchema = exports.createContactSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const normalizeIndianPhone = (value) => {
    const raw = String(value ?? '').trim();
    let cleaned = raw.replace(/[\s\-\(\)]/g, '');
    cleaned = cleaned.replace(/[^0-9+]/g, '');
    if (cleaned.startsWith('+91'))
        cleaned = cleaned.slice(3);
    else if (cleaned.startsWith('91') && cleaned.length === 12)
        cleaned = cleaned.slice(2);
    if (cleaned.startsWith('0') && cleaned.length === 11)
        cleaned = cleaned.slice(1);
    return cleaned;
};
const indian10DigitRegex = /^[6-9]\d{9}$/;
const phoneSchema = zod_1.z.preprocess((v) => normalizeIndianPhone(v), zod_1.z.string().regex(indian10DigitRegex, 'Only Indian 10-digit numbers starting with 6-9 are allowed'));
// ✅ email optional (blank/space ok)
const emailSchema = zod_1.z.preprocess((v) => {
    if (v === null || v === undefined)
        return undefined;
    const s = String(v).trim();
    return s === '' ? undefined : s;
}, zod_1.z.string().email('Invalid email format').optional());
// ============================================
// CONTACT SCHEMAS
// ============================================
exports.createContactSchema = zod_1.z.object({
    body: zod_1.z.object({
        phone: phoneSchema,
        countryCode: zod_1.z.string().optional().default('+91'),
        firstName: zod_1.z.string().optional(),
        lastName: zod_1.z.string().optional(),
        email: emailSchema,
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
        email: emailSchema,
        tags: zod_1.z.array(zod_1.z.string()).optional(),
        customFields: zod_1.z.record(zod_1.z.any()).optional(),
        status: zod_1.z.nativeEnum(client_1.ContactStatus).optional(),
    }),
});
exports.importContactsSchema = zod_1.z.object({
    body: zod_1.z.object({
        contacts: zod_1.z.array(zod_1.z.object({
            phone: phoneSchema, // ✅ normalized + validated
            firstName: zod_1.z.string().optional(),
            lastName: zod_1.z.string().optional(),
            email: emailSchema, // ✅ optional
            tags: zod_1.z.array(zod_1.z.string()).optional(),
            customFields: zod_1.z.record(zod_1.z.any()).optional(),
        })).min(1, 'At least one contact is required'),
        groupId: zod_1.z.string().optional(),
        groupName: zod_1.z.string().optional(),
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