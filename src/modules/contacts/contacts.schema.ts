// src/modules/contacts/contacts.schema.ts - COMPLETE FIXED

import { z } from 'zod';
import { ContactStatus } from '@prisma/client';

const normalizeIndianPhone = (value: unknown): string => {
  const raw = String(value ?? '').trim();
  let cleaned = raw.replace(/[\s\-\(\)]/g, '');
  cleaned = cleaned.replace(/[^0-9+]/g, '');

  if (cleaned.startsWith('+91')) cleaned = cleaned.slice(3);
  else if (cleaned.startsWith('91') && cleaned.length === 12) cleaned = cleaned.slice(2);

  if (cleaned.startsWith('0') && cleaned.length === 11) cleaned = cleaned.slice(1);

  return cleaned;
};

const indian10DigitRegex = /^[6-9]\d{9}$/;

const phoneSchema = z.preprocess(
  (v) => normalizeIndianPhone(v),
  z.string().regex(indian10DigitRegex, 'Only Indian 10-digit numbers starting with 6-9 are allowed')
);

// ✅ email optional (blank/space ok)
const emailSchema = z.preprocess(
  (v) => {
    if (v === null || v === undefined) return undefined;
    const s = String(v).trim();
    return s === '' ? undefined : s;
  },
  z.string().email('Invalid email format').optional()
);

// ============================================
// CONTACT SCHEMAS
// ============================================

export const createContactSchema = z.object({
  body: z.object({
    phone: phoneSchema,
    countryCode: z.string().optional().default('+91'),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: emailSchema,
    tags: z.array(z.string()).optional().default([]),
    customFields: z.record(z.any()).optional().default({}),
    groupIds: z.array(z.string()).optional(),
  }),
});

export const updateContactSchema = z.object({
  body: z.object({
    phone: phoneSchema.optional(),
    countryCode: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: emailSchema,
    tags: z.array(z.string()).optional(),
    customFields: z.record(z.any()).optional(),
    status: z.nativeEnum(ContactStatus).optional(),
  }),
});

export const importContactsSchema = z.object({
  body: z.object({
    contacts: z.array(
      z.object({
        phone: phoneSchema,          // ✅ normalized + validated
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        email: emailSchema,          // ✅ optional
        tags: z.array(z.string()).optional(),
        customFields: z.record(z.any()).optional(),
      })
    ).min(1, 'At least one contact is required'),
    groupId: z.string().optional(),
    groupName: z.string().optional(),
    tags: z.array(z.string()).optional(),
    skipDuplicates: z.boolean().optional().default(true),
  }),
});

export const bulkUpdateSchema = z.object({
  body: z.object({
    contactIds: z.array(z.string()).min(1, 'At least one contact ID is required'),
    tags: z.array(z.string()).optional(),
    groupIds: z.array(z.string()).optional(),
    status: z.nativeEnum(ContactStatus).optional(),
  }),
});

export const bulkDeleteSchema = z.object({
  body: z.object({
    contactIds: z.array(z.string()).min(1, 'At least one contact ID is required'),
  }),
});

// ============================================
// CONTACT GROUP SCHEMAS
// ============================================

export const createContactGroupSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Group name is required'),
    description: z.string().optional(),
    color: z.string().optional(),
  }),
});

export const updateContactGroupSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    color: z.string().optional(),
  }),
});

export const addContactsToGroupSchema = z.object({
  body: z.object({
    contactIds: z.array(z.string()).min(1, 'At least one contact ID is required'),
  }),
});