"use strict";
// src/modules/admin/admin.schema.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActivityLogsSchema = exports.updateSystemSettingsSchema = exports.updatePlanSchema = exports.createPlanSchema = exports.updateSubscriptionSchema = exports.deleteOrganizationSchema = exports.updateOrganizationSchema = exports.getOrganizationByIdSchema = exports.getOrganizationsSchema = exports.deleteUserSchema = exports.updateUserSchema = exports.getUserByIdSchema = exports.getUsersSchema = exports.updateAdminSchema = exports.createAdminSchema = exports.adminLoginSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
// ============================================
// ADMIN AUTH SCHEMAS
// ============================================
exports.adminLoginSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email('Invalid email address'),
        password: zod_1.z.string().min(1, 'Password is required'),
    }),
});
exports.createAdminSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email('Invalid email address'),
        password: zod_1.z.string().min(8, 'Password must be at least 8 characters'),
        name: zod_1.z.string().min(2, 'Name is required').max(100),
        role: zod_1.z.enum(['admin', 'super_admin']).optional().default('admin'),
    }),
});
exports.updateAdminSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Admin ID is required'),
    }),
    body: zod_1.z.object({
        name: zod_1.z.string().min(2).max(100).optional(),
        email: zod_1.z.string().email().optional(),
        password: zod_1.z.string().min(8).optional(),
        role: zod_1.z.enum(['admin', 'super_admin']).optional(),
        isActive: zod_1.z.boolean().optional(),
    }),
});
// ============================================
// USER MANAGEMENT SCHEMAS
// ============================================
exports.getUsersSchema = zod_1.z.object({
    query: zod_1.z.object({
        page: zod_1.z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
        limit: zod_1.z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
        search: zod_1.z.string().optional(),
        status: zod_1.z.nativeEnum(client_1.UserStatus).optional(),
        sortBy: zod_1.z.enum(['createdAt', 'email', 'firstName', 'lastLoginAt']).optional().default('createdAt'),
        sortOrder: zod_1.z.enum(['asc', 'desc']).optional().default('desc'),
    }),
});
exports.getUserByIdSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'User ID is required'),
    }),
});
exports.updateUserSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'User ID is required'),
    }),
    body: zod_1.z.object({
        firstName: zod_1.z.string().min(2).max(50).optional(),
        lastName: zod_1.z.string().max(50).optional().nullable(),
        status: zod_1.z.nativeEnum(client_1.UserStatus).optional(),
        emailVerified: zod_1.z.boolean().optional(),
    }),
});
exports.deleteUserSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'User ID is required'),
    }),
});
// ============================================
// ORGANIZATION MANAGEMENT SCHEMAS
// ============================================
exports.getOrganizationsSchema = zod_1.z.object({
    query: zod_1.z.object({
        page: zod_1.z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
        limit: zod_1.z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
        search: zod_1.z.string().optional(),
        planType: zod_1.z.nativeEnum(client_1.PlanType).optional(),
        sortBy: zod_1.z.enum(['createdAt', 'name', 'planType']).optional().default('createdAt'),
        sortOrder: zod_1.z.enum(['asc', 'desc']).optional().default('desc'),
    }),
});
exports.getOrganizationByIdSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Organization ID is required'),
    }),
});
exports.updateOrganizationSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Organization ID is required'),
    }),
    body: zod_1.z.object({
        name: zod_1.z.string().min(2).max(100).optional(),
        planType: zod_1.z.nativeEnum(client_1.PlanType).optional(),
    }),
});
exports.deleteOrganizationSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Organization ID is required'),
    }),
});
// ============================================
// SUBSCRIPTION MANAGEMENT SCHEMAS
// ============================================
exports.updateSubscriptionSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Organization ID is required'),
    }),
    body: zod_1.z.object({
        planId: zod_1.z.string().optional(),
        status: zod_1.z.nativeEnum(client_1.SubscriptionStatus).optional(),
        currentPeriodEnd: zod_1.z.string().datetime().optional(),
        messagesUsed: zod_1.z.number().min(0).optional(),
        contactsUsed: zod_1.z.number().min(0).optional(),
    }),
});
// ============================================
// PLAN MANAGEMENT SCHEMAS
// ============================================
exports.createPlanSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1).max(50),
        type: zod_1.z.nativeEnum(client_1.PlanType),
        description: zod_1.z.string().max(500).optional(),
        monthlyPrice: zod_1.z.number().min(0),
        yearlyPrice: zod_1.z.number().min(0),
        maxContacts: zod_1.z.number().min(0),
        maxMessages: zod_1.z.number().min(0),
        maxTeamMembers: zod_1.z.number().min(1),
        maxCampaigns: zod_1.z.number().min(0),
        maxChatbots: zod_1.z.number().min(0),
        maxTemplates: zod_1.z.number().min(0),
        features: zod_1.z.array(zod_1.z.string()).optional().default([]),
    }),
});
exports.updatePlanSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Plan ID is required'),
    }),
    body: zod_1.z.object({
        name: zod_1.z.string().min(1).max(50).optional(),
        description: zod_1.z.string().max(500).optional().nullable(),
        monthlyPrice: zod_1.z.number().min(0).optional(),
        yearlyPrice: zod_1.z.number().min(0).optional(),
        maxContacts: zod_1.z.number().min(0).optional(),
        maxMessages: zod_1.z.number().min(0).optional(),
        maxTeamMembers: zod_1.z.number().min(1).optional(),
        maxCampaigns: zod_1.z.number().min(0).optional(),
        maxChatbots: zod_1.z.number().min(0).optional(),
        maxTemplates: zod_1.z.number().min(0).optional(),
        features: zod_1.z.array(zod_1.z.string()).optional(),
        isActive: zod_1.z.boolean().optional(),
    }),
});
// ============================================
// SYSTEM SETTINGS SCHEMAS
// ============================================
exports.updateSystemSettingsSchema = zod_1.z.object({
    body: zod_1.z.object({
        maintenanceMode: zod_1.z.boolean().optional(),
        registrationEnabled: zod_1.z.boolean().optional(),
        defaultPlan: zod_1.z.nativeEnum(client_1.PlanType).optional(),
        maxOrganizationsPerUser: zod_1.z.number().min(1).max(100).optional(),
        maxContactsFreePlan: zod_1.z.number().min(0).optional(),
        maxMessagesFreePlan: zod_1.z.number().min(0).optional(),
    }),
});
// ============================================
// ACTIVITY LOGS SCHEMAS
// ============================================
exports.getActivityLogsSchema = zod_1.z.object({
    query: zod_1.z.object({
        page: zod_1.z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
        limit: zod_1.z.string().regex(/^\d+$/).transform(Number).optional().default('50'),
        action: zod_1.z.string().optional(),
        userId: zod_1.z.string().optional(),
        organizationId: zod_1.z.string().optional(),
        startDate: zod_1.z.string().datetime().optional(),
        endDate: zod_1.z.string().datetime().optional(),
    }),
});
//# sourceMappingURL=admin.schema.js.map