// src/modules/contacts/contacts.schema.ts

import { z } from 'zod';
import { ContactStatus } from '@prisma/client';

// Indian phone number validation regex
const indianPhoneRegex = /^(\+91|91)?[6-9]\d{9}$/;

// Phone schema with validation and normalization
const phoneSchema = z.string()
  .min(10, 'Phone number must be at least 10 digits')
  .regex(indianPhoneRegex, 'Only Indian phone numbers (+91) starting with 6-9 are allowed')
  .transform(phone => {
    // Normalize to 10-digit format
    let cleaned = phone.replace(/[\s\-\(\)]/g, '');
    if (cleaned.startsWith('+91')) {
      return cleaned.substring(3);
    } else if (cleaned.startsWith('91')) {
      return cleaned.substring(2);
    }
    return cleaned;
  });

// ============================================
// CONTACT SCHEMAS
// ============================================

export const createContactSchema = z.object({
  body: z.object({
    phone: phoneSchema,
    countryCode: z.string().optional().default('+91'),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
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
    email: z.string().email().optional().or(z.literal('')),
    tags: z.array(z.string()).optional(),
    customFields: z.record(z.any()).optional(),
    status: z.nativeEnum(ContactStatus).optional(),
  }),
});

export const importContactsSchema = z.object({
  body: z.object({
    contacts: z.array(
      z.object({
        phone: z.string().regex(indianPhoneRegex, 'Invalid Indian phone number'),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        email: z.string().email().optional().or(z.literal('')),
        tags: z.array(z.string()).optional(),
        customFields: z.record(z.any()).optional(),
      })
    ).min(1, 'At least one contact is required'),
    groupId: z.string().optional(),
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