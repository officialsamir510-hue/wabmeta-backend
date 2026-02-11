"use strict";
// src/modules/users/users.schema.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserByIdSchema = exports.deleteAccountSchema = exports.updateNotificationSettingsSchema = exports.updateAvatarSchema = exports.updateProfileSchema = void 0;
const zod_1 = require("zod");
// ============================================
// VALIDATORS
// ============================================
const nameSchema = zod_1.z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name is too long')
    .trim();
const phoneSchema = zod_1.z
    .string()
    .regex(/^\+?[1-9]\d{9,14}$/, 'Invalid phone number')
    .optional()
    .nullable();
const urlSchema = zod_1.z
    .string()
    .url('Invalid URL')
    .optional()
    .nullable();
// ============================================
// REQUEST SCHEMAS
// ============================================
exports.updateProfileSchema = zod_1.z.object({
    body: zod_1.z.object({
        firstName: nameSchema.optional(),
        lastName: nameSchema.optional().nullable(),
        phone: phoneSchema,
        avatar: urlSchema,
    }),
});
exports.updateAvatarSchema = zod_1.z.object({
    body: zod_1.z.object({
        avatar: zod_1.z.string().url('Invalid avatar URL'),
    }),
});
exports.updateNotificationSettingsSchema = zod_1.z.object({
    body: zod_1.z.object({
        emailNotifications: zod_1.z.boolean().optional(),
        pushNotifications: zod_1.z.boolean().optional(),
        smsNotifications: zod_1.z.boolean().optional(),
        marketingEmails: zod_1.z.boolean().optional(),
    }),
});
exports.deleteAccountSchema = zod_1.z.object({
    body: zod_1.z.object({
        password: zod_1.z.string().min(1, 'Password is required'),
        reason: zod_1.z.string().max(500, 'Reason is too long').optional(),
    }),
});
exports.getUserByIdSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'User ID is required'),
    }),
});
//# sourceMappingURL=users.schema.js.map