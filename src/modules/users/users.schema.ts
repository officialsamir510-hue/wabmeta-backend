// src/modules/users/users.schema.ts

import { z } from 'zod';

// ============================================
// VALIDATORS
// ============================================

const nameSchema = z
  .string()
  .min(2, 'Name must be at least 2 characters')
  .max(50, 'Name is too long')
  .trim();

const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{9,14}$/, 'Invalid phone number')
  .optional()
  .nullable();

const urlSchema = z
  .string()
  .url('Invalid URL')
  .optional()
  .nullable();

// ============================================
// REQUEST SCHEMAS
// ============================================

export const updateProfileSchema = z.object({
  body: z.object({
    firstName: nameSchema.optional(),
    lastName: nameSchema.optional().nullable(),
    phone: phoneSchema,
    avatar: urlSchema,
  }),
});

export const updateAvatarSchema = z.object({
  body: z.object({
    avatar: z.string().url('Invalid avatar URL'),
  }),
});

export const updateNotificationSettingsSchema = z.object({
  body: z.object({
    emailNotifications: z.boolean().optional(),
    pushNotifications: z.boolean().optional(),
    smsNotifications: z.boolean().optional(),
    marketingEmails: z.boolean().optional(),
  }),
});

export const deleteAccountSchema = z.object({
  body: z.object({
    password: z.string().min(1, 'Password is required'),
    reason: z.string().max(500, 'Reason is too long').optional(),
  }),
});

export const getUserByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'User ID is required'),
  }),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type UpdateProfileSchema = z.infer<typeof updateProfileSchema>;
export type UpdateAvatarSchema = z.infer<typeof updateAvatarSchema>;
export type DeleteAccountSchema = z.infer<typeof deleteAccountSchema>;