// src/modules/contacts/contacts.schema.ts

import { z } from 'zod';
import { ContactStatus } from '@prisma/client';

// ============================================
// VALIDATORS
// ============================================

const phoneSchema = z
  .string()
  .min(10, 'Phone number must be at least 10 digits')
  .max(15, 'Phone number is too long')
  .regex(/^[0-9]+$/, 'Phone number must contain only digits');

const countryCodeSchema = z
  .string()
  .regex(/^\+[1-9]\d{0,3}$/, 'Invalid country code (e.g., +91)')
  .default('+91');

const emailSchema = z
  .string()
  .email('Invalid email address')
  .optional()
  .nullable();

const nameSchema = z
  .string()
  .max(50, 'Name is too long')
  .optional()
  .nullable();

const tagsSchema = z
  .array(z.string().max(30))
  .max(20, 'Maximum 20 tags allowed')
  .optional()
  .default([]);

const colorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format')
  .optional();

// ============================================
// REQUEST SCHEMAS
// ============================================

export const createContactSchema = z.object({
  body: z.object({
    phone: phoneSchema,
    countryCode: countryCodeSchema,
    firstName: nameSchema,
    lastName: nameSchema,
    email: emailSchema,
    tags: tagsSchema,
    customFields: z.record(z.any()).optional().default({}),
    groupIds: z.array(z.string()).optional().default([]),
  }),
});

export const updateContactSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Contact ID is required'),
  }),
  body: z.object({
    phone: phoneSchema.optional(),
    countryCode: countryCodeSchema.optional(),
    firstName: nameSchema,
    lastName: nameSchema,
    email: emailSchema,
    tags: tagsSchema,
    customFields: z.record(z.any()).optional(),
    status: z.nativeEnum(ContactStatus).optional(),
  }),
});

export const getContactsSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
    search: z.string().optional(),
    status: z.nativeEnum(ContactStatus).optional(),
    tags: z.string().optional(), // comma-separated
    groupId: z.string().optional(),
    sortBy: z.enum(['createdAt', 'firstName', 'lastName', 'lastMessageAt']).optional().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  }),
});

export const getContactByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Contact ID is required'),
  }),
});

export const deleteContactSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Contact ID is required'),
  }),
});

export const importContactsSchema = z.object({
  body: z.object({
    contacts: z.array(z.object({
      phone: phoneSchema,
      countryCode: countryCodeSchema.optional(),
      firstName: nameSchema,
      lastName: nameSchema,
      email: emailSchema,
      tags: tagsSchema,
      customFields: z.record(z.any()).optional(),
    })).min(1, 'At least one contact is required').max(10000, 'Maximum 10000 contacts per import'),
    groupId: z.string().optional(),
    tags: tagsSchema,
    skipDuplicates: z.boolean().optional().default(true),
  }),
});

export const bulkUpdateContactsSchema = z.object({
  body: z.object({
    contactIds: z.array(z.string()).min(1, 'At least one contact ID is required'),
    tags: tagsSchema.optional(),
    groupIds: z.array(z.string()).optional(),
    status: z.nativeEnum(ContactStatus).optional(),
  }),
});

export const bulkDeleteContactsSchema = z.object({
  body: z.object({
    contactIds: z.array(z.string()).min(1, 'At least one contact ID is required'),
  }),
});

// Contact Groups Schemas
export const createContactGroupSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Group name is required').max(50, 'Group name is too long'),
    description: z.string().max(200, 'Description is too long').optional(),
    color: colorSchema,
  }),
});

export const updateContactGroupSchema = z.object({
  params: z.object({
    groupId: z.string().min(1, 'Group ID is required'),
  }),
  body: z.object({
    name: z.string().min(1).max(50).optional(),
    description: z.string().max(200).optional().nullable(),
    color: colorSchema,
  }),
});

export const addContactsToGroupSchema = z.object({
  params: z.object({
    groupId: z.string().min(1, 'Group ID is required'),
  }),
  body: z.object({
    contactIds: z.array(z.string()).min(1, 'At least one contact ID is required'),
  }),
});

export const removeContactsFromGroupSchema = z.object({
  params: z.object({
    groupId: z.string().min(1, 'Group ID is required'),
  }),
  body: z.object({
    contactIds: z.array(z.string()).min(1, 'At least one contact ID is required'),
  }),
});

export const deleteContactGroupSchema = z.object({
  params: z.object({
    groupId: z.string().min(1, 'Group ID is required'),
  }),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type CreateContactSchema = z.infer<typeof createContactSchema>;
export type UpdateContactSchema = z.infer<typeof updateContactSchema>;
export type GetContactsSchema = z.infer<typeof getContactsSchema>;
export type ImportContactsSchema = z.infer<typeof importContactsSchema>;
export type BulkUpdateContactsSchema = z.infer<typeof bulkUpdateContactsSchema>;
export type CreateContactGroupSchema = z.infer<typeof createContactGroupSchema>;