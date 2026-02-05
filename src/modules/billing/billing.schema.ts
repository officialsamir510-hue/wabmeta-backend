// src/modules/billing/billing.schema.ts

import { z } from 'zod';
import { PlanType } from '@prisma/client';

// ============================================
// REQUEST SCHEMAS
// ============================================

export const upgradePlanSchema = z.object({
  body: z.object({
    planType: z.nativeEnum(PlanType),
    billingCycle: z.enum(['monthly', 'yearly']).default('monthly'),
    paymentMethodId: z.string().optional(),
  }),
});

export const addPaymentMethodSchema = z.object({
  body: z.object({
    type: z.enum(['card', 'upi', 'bank']),
    details: z.object({
      cardNumber: z.string().optional(),
      expiryMonth: z.string().optional(),
      expiryYear: z.string().optional(),
      cvv: z.string().optional(),
      upiId: z.string().optional(),
      accountNumber: z.string().optional(),
      ifsc: z.string().optional(),
    }),
    isDefault: z.boolean().optional().default(false),
  }),
});

export const deletePaymentMethodSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Payment method ID is required'),
  }),
});

export const setDefaultPaymentMethodSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Payment method ID is required'),
  }),
});

export const getInvoicesSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('10'),
  }),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type UpgradePlanSchema = z.infer<typeof upgradePlanSchema>;
export type AddPaymentMethodSchema = z.infer<typeof addPaymentMethodSchema>;