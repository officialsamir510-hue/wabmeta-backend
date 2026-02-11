"use strict";
// src/modules/organizations/organizations.schema.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.switchOrganizationSchema = exports.getOrganizationByIdSchema = exports.transferOwnershipSchema = exports.removeMemberSchema = exports.updateMemberRoleSchema = exports.inviteMemberSchema = exports.updateOrganizationSchema = exports.createOrganizationSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
// ============================================
// VALIDATORS
// ============================================
const nameSchema = zod_1.z
    .string()
    .min(2, 'Organization name must be at least 2 characters')
    .max(100, 'Organization name is too long')
    .trim();
const urlSchema = zod_1.z
    .string()
    .url('Invalid URL')
    .optional()
    .nullable();
const timezoneSchema = zod_1.z
    .string()
    .regex(/^[A-Za-z_\/]+$/, 'Invalid timezone format')
    .optional();
const roleSchema = zod_1.z.nativeEnum(client_1.UserRole);
// ============================================
// REQUEST SCHEMAS
// ============================================
exports.createOrganizationSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: nameSchema,
        website: urlSchema,
        industry: zod_1.z.string().max(50).optional(),
        timezone: timezoneSchema,
    }),
});
exports.updateOrganizationSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: nameSchema.optional(),
        logo: urlSchema,
        website: urlSchema,
        industry: zod_1.z.string().max(50).optional().nullable(),
        timezone: timezoneSchema,
    }),
});
exports.inviteMemberSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email('Invalid email address'),
        role: roleSchema.default('MEMBER'),
    }),
});
exports.updateMemberRoleSchema = zod_1.z.object({
    params: zod_1.z.object({
        memberId: zod_1.z.string().min(1, 'Member ID is required'),
    }),
    body: zod_1.z.object({
        role: roleSchema,
    }),
});
exports.removeMemberSchema = zod_1.z.object({
    params: zod_1.z.object({
        memberId: zod_1.z.string().min(1, 'Member ID is required'),
    }),
});
exports.transferOwnershipSchema = zod_1.z.object({
    body: zod_1.z.object({
        newOwnerId: zod_1.z.string().min(1, 'New owner ID is required'),
        password: zod_1.z.string().min(1, 'Password is required'),
    }),
});
exports.getOrganizationByIdSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Organization ID is required'),
    }),
});
exports.switchOrganizationSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Organization ID is required'),
    }),
});
//# sourceMappingURL=organizations.schema.js.map