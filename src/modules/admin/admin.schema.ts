// src/modules/admin/admin.schema.ts

import { z } from 'zod';
import { PlanType, UserStatus, SubscriptionStatus } from '@prisma/client';

// ============================================
// ADMIN AUTH SCHEMAS
// ============================================

export const adminLoginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const createAdminSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    name: z.string().min(2, 'Name is required').max(100),
    role: z.enum(['admin', 'super_admin']).optional().default('admin'),
  }),
});

export const updateAdminSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Admin ID is required'),
  }),
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    email: z.string().email().optional(),
    password: z.string().min(8).optional(),
    role: z.enum(['admin', 'super_admin']).optional(),
    isActive: z.boolean().optional(),
  }),
});

// ============================================
// USER MANAGEMENT SCHEMAS
// ============================================

export const getUsersSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
    search: z.string().optional(),
    status: z.nativeEnum(UserStatus).optional(),
    sortBy: z.enum(['createdAt', 'email', 'firstName', 'lastLoginAt']).optional().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  }),
});

export const getUserByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'User ID is required'),
  }),
});

export const updateUserSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'User ID is required'),
  }),
  body: z.object({
    firstName: z.string().min(2).max(50).optional(),
    lastName: z.string().max(50).optional().nullable(),
    status: z.nativeEnum(UserStatus).optional(),
    emailVerified: z.boolean().optional(),
  }),
});

export const deleteUserSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'User ID is required'),
  }),
});

// ============================================
// ORGANIZATION MANAGEMENT SCHEMAS
// ============================================

export const getOrganizationsSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
    search: z.string().optional(),
    planType: z.nativeEnum(PlanType).optional(),
    sortBy: z.enum(['createdAt', 'name', 'planType']).optional().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  }),
});

export const getOrganizationByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Organization ID is required'),
  }),
});

export const updateOrganizationSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Organization ID is required'),
  }),
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    planType: z.nativeEnum(PlanType).optional(),
  }),
});

export const deleteOrganizationSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Organization ID is required'),
  }),
});

// ============================================
// SUBSCRIPTION MANAGEMENT SCHEMAS
// ============================================

export const updateSubscriptionSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Organization ID is required'),
  }),
  body: z.object({
    planId: z.string().optional(),
    status: z.nativeEnum(SubscriptionStatus).optional(),
    currentPeriodEnd: z.string().datetime().optional(),
    messagesUsed: z.number().min(0).optional(),
    contactsUsed: z.number().min(0).optional(),
  }),
});

// ============================================
// PLAN MANAGEMENT SCHEMAS
// ============================================

export const createPlanSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(50),
    type: z.nativeEnum(PlanType),
    description: z.string().max(500).optional(),
    monthlyPrice: z.number().min(0),
    yearlyPrice: z.number().min(0),
    maxContacts: z.number().min(0),
    maxMessages: z.number().min(0),
    maxTeamMembers: z.number().min(1),
    maxCampaigns: z.number().min(0),
    maxChatbots: z.number().min(0),
    maxTemplates: z.number().min(0),
    features: z.array(z.string()).optional().default([]),
  }),
});

export const updatePlanSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Plan ID is required'),
  }),
  body: z.object({
    name: z.string().min(1).max(50).optional(),
    description: z.string().max(500).optional().nullable(),
    monthlyPrice: z.number().min(0).optional(),
    yearlyPrice: z.number().min(0).optional(),
    maxContacts: z.number().min(0).optional(),
    maxMessages: z.number().min(0).optional(),
    maxTeamMembers: z.number().min(1).optional(),
    maxCampaigns: z.number().min(0).optional(),
    maxChatbots: z.number().min(0).optional(),
    maxTemplates: z.number().min(0).optional(),
    features: z.array(z.string()).optional(),
    isActive: z.boolean().optional(),
  }),
});

// ============================================
// SYSTEM SETTINGS SCHEMAS
// ============================================

export const updateSystemSettingsSchema = z.object({
  body: z.object({
    maintenanceMode: z.boolean().optional(),
    registrationEnabled: z.boolean().optional(),
    defaultPlan: z.nativeEnum(PlanType).optional(),
    maxOrganizationsPerUser: z.number().min(1).max(100).optional(),
    maxContactsFreePlan: z.number().min(0).optional(),
    maxMessagesFreePlan: z.number().min(0).optional(),
  }),
});

// ============================================
// ACTIVITY LOGS SCHEMAS
// ============================================

export const getActivityLogsSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('50'),
    action: z.string().optional(),
    userId: z.string().optional(),
    organizationId: z.string().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type AdminLoginSchema = z.infer<typeof adminLoginSchema>;
export type CreateAdminSchema = z.infer<typeof createAdminSchema>;
export type UpdateAdminSchema = z.infer<typeof updateAdminSchema>;
export type GetUsersSchema = z.infer<typeof getUsersSchema>;
export type UpdateUserSchema = z.infer<typeof updateUserSchema>;
export type GetOrganizationsSchema = z.infer<typeof getOrganizationsSchema>;
export type UpdateOrganizationSchema = z.infer<typeof updateOrganizationSchema>;
export type UpdateSubscriptionSchema = z.infer<typeof updateSubscriptionSchema>;
export type CreatePlanSchema = z.infer<typeof createPlanSchema>;
export type UpdatePlanSchema = z.infer<typeof updatePlanSchema>;
export type UpdateSystemSettingsSchema = z.infer<typeof updateSystemSettingsSchema>;
export type GetActivityLogsSchema = z.infer<typeof getActivityLogsSchema>;