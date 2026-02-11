import { z } from 'zod';
export declare const adminLoginSchema: z.ZodObject<{
    body: z.ZodObject<{
        email: z.ZodString;
        password: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        email: string;
        password: string;
    }, {
        email: string;
        password: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        email: string;
        password: string;
    };
}, {
    body: {
        email: string;
        password: string;
    };
}>;
export declare const createAdminSchema: z.ZodObject<{
    body: z.ZodObject<{
        email: z.ZodString;
        password: z.ZodString;
        name: z.ZodString;
        role: z.ZodDefault<z.ZodOptional<z.ZodEnum<["admin", "super_admin"]>>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        email: string;
        password: string;
        role: "admin" | "super_admin";
    }, {
        name: string;
        email: string;
        password: string;
        role?: "admin" | "super_admin" | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        name: string;
        email: string;
        password: string;
        role: "admin" | "super_admin";
    };
}, {
    body: {
        name: string;
        email: string;
        password: string;
        role?: "admin" | "super_admin" | undefined;
    };
}>;
export declare const updateAdminSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    body: z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        email: z.ZodOptional<z.ZodString>;
        password: z.ZodOptional<z.ZodString>;
        role: z.ZodOptional<z.ZodEnum<["admin", "super_admin"]>>;
        isActive: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        name?: string | undefined;
        email?: string | undefined;
        password?: string | undefined;
        role?: "admin" | "super_admin" | undefined;
        isActive?: boolean | undefined;
    }, {
        name?: string | undefined;
        email?: string | undefined;
        password?: string | undefined;
        role?: "admin" | "super_admin" | undefined;
        isActive?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        id: string;
    };
    body: {
        name?: string | undefined;
        email?: string | undefined;
        password?: string | undefined;
        role?: "admin" | "super_admin" | undefined;
        isActive?: boolean | undefined;
    };
}, {
    params: {
        id: string;
    };
    body: {
        name?: string | undefined;
        email?: string | undefined;
        password?: string | undefined;
        role?: "admin" | "super_admin" | undefined;
        isActive?: boolean | undefined;
    };
}>;
export declare const getUsersSchema: z.ZodObject<{
    query: z.ZodObject<{
        page: z.ZodDefault<z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>>;
        limit: z.ZodDefault<z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>>;
        search: z.ZodOptional<z.ZodString>;
        status: z.ZodOptional<z.ZodNativeEnum<{
            ACTIVE: "ACTIVE";
            INACTIVE: "INACTIVE";
            SUSPENDED: "SUSPENDED";
            PENDING_VERIFICATION: "PENDING_VERIFICATION";
        }>>;
        sortBy: z.ZodDefault<z.ZodOptional<z.ZodEnum<["createdAt", "email", "firstName", "lastLoginAt"]>>>;
        sortOrder: z.ZodDefault<z.ZodOptional<z.ZodEnum<["asc", "desc"]>>>;
    }, "strip", z.ZodTypeAny, {
        page: number;
        limit: number;
        sortBy: "email" | "firstName" | "lastLoginAt" | "createdAt";
        sortOrder: "asc" | "desc";
        search?: string | undefined;
        status?: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION" | undefined;
    }, {
        search?: string | undefined;
        page?: string | undefined;
        limit?: string | undefined;
        status?: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION" | undefined;
        sortBy?: "email" | "firstName" | "lastLoginAt" | "createdAt" | undefined;
        sortOrder?: "asc" | "desc" | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        page: number;
        limit: number;
        sortBy: "email" | "firstName" | "lastLoginAt" | "createdAt";
        sortOrder: "asc" | "desc";
        search?: string | undefined;
        status?: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION" | undefined;
    };
}, {
    query: {
        search?: string | undefined;
        page?: string | undefined;
        limit?: string | undefined;
        status?: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION" | undefined;
        sortBy?: "email" | "firstName" | "lastLoginAt" | "createdAt" | undefined;
        sortOrder?: "asc" | "desc" | undefined;
    };
}>;
export declare const getUserByIdSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        id: string;
    };
}, {
    params: {
        id: string;
    };
}>;
export declare const updateUserSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    body: z.ZodObject<{
        firstName: z.ZodOptional<z.ZodString>;
        lastName: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        status: z.ZodOptional<z.ZodNativeEnum<{
            ACTIVE: "ACTIVE";
            INACTIVE: "INACTIVE";
            SUSPENDED: "SUSPENDED";
            PENDING_VERIFICATION: "PENDING_VERIFICATION";
        }>>;
        emailVerified: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        firstName?: string | undefined;
        lastName?: string | null | undefined;
        status?: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION" | undefined;
        emailVerified?: boolean | undefined;
    }, {
        firstName?: string | undefined;
        lastName?: string | null | undefined;
        status?: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION" | undefined;
        emailVerified?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        id: string;
    };
    body: {
        firstName?: string | undefined;
        lastName?: string | null | undefined;
        status?: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION" | undefined;
        emailVerified?: boolean | undefined;
    };
}, {
    params: {
        id: string;
    };
    body: {
        firstName?: string | undefined;
        lastName?: string | null | undefined;
        status?: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION" | undefined;
        emailVerified?: boolean | undefined;
    };
}>;
export declare const deleteUserSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        id: string;
    };
}, {
    params: {
        id: string;
    };
}>;
export declare const getOrganizationsSchema: z.ZodObject<{
    query: z.ZodObject<{
        page: z.ZodDefault<z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>>;
        limit: z.ZodDefault<z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>>;
        search: z.ZodOptional<z.ZodString>;
        planType: z.ZodOptional<z.ZodNativeEnum<{
            FREE: "FREE";
            STARTER: "STARTER";
            PRO: "PRO";
            ENTERPRISE: "ENTERPRISE";
        }>>;
        sortBy: z.ZodDefault<z.ZodOptional<z.ZodEnum<["createdAt", "name", "planType"]>>>;
        sortOrder: z.ZodDefault<z.ZodOptional<z.ZodEnum<["asc", "desc"]>>>;
    }, "strip", z.ZodTypeAny, {
        page: number;
        limit: number;
        sortBy: "name" | "createdAt" | "planType";
        sortOrder: "asc" | "desc";
        search?: string | undefined;
        planType?: "FREE" | "STARTER" | "PRO" | "ENTERPRISE" | undefined;
    }, {
        search?: string | undefined;
        page?: string | undefined;
        limit?: string | undefined;
        planType?: "FREE" | "STARTER" | "PRO" | "ENTERPRISE" | undefined;
        sortBy?: "name" | "createdAt" | "planType" | undefined;
        sortOrder?: "asc" | "desc" | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        page: number;
        limit: number;
        sortBy: "name" | "createdAt" | "planType";
        sortOrder: "asc" | "desc";
        search?: string | undefined;
        planType?: "FREE" | "STARTER" | "PRO" | "ENTERPRISE" | undefined;
    };
}, {
    query: {
        search?: string | undefined;
        page?: string | undefined;
        limit?: string | undefined;
        planType?: "FREE" | "STARTER" | "PRO" | "ENTERPRISE" | undefined;
        sortBy?: "name" | "createdAt" | "planType" | undefined;
        sortOrder?: "asc" | "desc" | undefined;
    };
}>;
export declare const getOrganizationByIdSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        id: string;
    };
}, {
    params: {
        id: string;
    };
}>;
export declare const updateOrganizationSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    body: z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        planType: z.ZodOptional<z.ZodNativeEnum<{
            FREE: "FREE";
            STARTER: "STARTER";
            PRO: "PRO";
            ENTERPRISE: "ENTERPRISE";
        }>>;
    }, "strip", z.ZodTypeAny, {
        name?: string | undefined;
        planType?: "FREE" | "STARTER" | "PRO" | "ENTERPRISE" | undefined;
    }, {
        name?: string | undefined;
        planType?: "FREE" | "STARTER" | "PRO" | "ENTERPRISE" | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        id: string;
    };
    body: {
        name?: string | undefined;
        planType?: "FREE" | "STARTER" | "PRO" | "ENTERPRISE" | undefined;
    };
}, {
    params: {
        id: string;
    };
    body: {
        name?: string | undefined;
        planType?: "FREE" | "STARTER" | "PRO" | "ENTERPRISE" | undefined;
    };
}>;
export declare const deleteOrganizationSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        id: string;
    };
}, {
    params: {
        id: string;
    };
}>;
export declare const updateSubscriptionSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    body: z.ZodObject<{
        planId: z.ZodOptional<z.ZodString>;
        status: z.ZodOptional<z.ZodNativeEnum<{
            ACTIVE: "ACTIVE";
            CANCELLED: "CANCELLED";
            EXPIRED: "EXPIRED";
            PAST_DUE: "PAST_DUE";
        }>>;
        currentPeriodEnd: z.ZodOptional<z.ZodString>;
        messagesUsed: z.ZodOptional<z.ZodNumber>;
        contactsUsed: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        status?: "ACTIVE" | "CANCELLED" | "EXPIRED" | "PAST_DUE" | undefined;
        currentPeriodEnd?: string | undefined;
        messagesUsed?: number | undefined;
        contactsUsed?: number | undefined;
        planId?: string | undefined;
    }, {
        status?: "ACTIVE" | "CANCELLED" | "EXPIRED" | "PAST_DUE" | undefined;
        currentPeriodEnd?: string | undefined;
        messagesUsed?: number | undefined;
        contactsUsed?: number | undefined;
        planId?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        id: string;
    };
    body: {
        status?: "ACTIVE" | "CANCELLED" | "EXPIRED" | "PAST_DUE" | undefined;
        currentPeriodEnd?: string | undefined;
        messagesUsed?: number | undefined;
        contactsUsed?: number | undefined;
        planId?: string | undefined;
    };
}, {
    params: {
        id: string;
    };
    body: {
        status?: "ACTIVE" | "CANCELLED" | "EXPIRED" | "PAST_DUE" | undefined;
        currentPeriodEnd?: string | undefined;
        messagesUsed?: number | undefined;
        contactsUsed?: number | undefined;
        planId?: string | undefined;
    };
}>;
export declare const createPlanSchema: z.ZodObject<{
    body: z.ZodObject<{
        name: z.ZodString;
        type: z.ZodNativeEnum<{
            FREE: "FREE";
            STARTER: "STARTER";
            PRO: "PRO";
            ENTERPRISE: "ENTERPRISE";
        }>;
        description: z.ZodOptional<z.ZodString>;
        monthlyPrice: z.ZodNumber;
        yearlyPrice: z.ZodNumber;
        maxContacts: z.ZodNumber;
        maxMessages: z.ZodNumber;
        maxTeamMembers: z.ZodNumber;
        maxCampaigns: z.ZodNumber;
        maxChatbots: z.ZodNumber;
        maxTemplates: z.ZodNumber;
        features: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        type: "FREE" | "STARTER" | "PRO" | "ENTERPRISE";
        monthlyPrice: number;
        yearlyPrice: number;
        maxContacts: number;
        maxMessages: number;
        maxTeamMembers: number;
        maxCampaigns: number;
        maxChatbots: number;
        maxTemplates: number;
        features: string[];
        description?: string | undefined;
    }, {
        name: string;
        type: "FREE" | "STARTER" | "PRO" | "ENTERPRISE";
        monthlyPrice: number;
        yearlyPrice: number;
        maxContacts: number;
        maxMessages: number;
        maxTeamMembers: number;
        maxCampaigns: number;
        maxChatbots: number;
        maxTemplates: number;
        description?: string | undefined;
        features?: string[] | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        name: string;
        type: "FREE" | "STARTER" | "PRO" | "ENTERPRISE";
        monthlyPrice: number;
        yearlyPrice: number;
        maxContacts: number;
        maxMessages: number;
        maxTeamMembers: number;
        maxCampaigns: number;
        maxChatbots: number;
        maxTemplates: number;
        features: string[];
        description?: string | undefined;
    };
}, {
    body: {
        name: string;
        type: "FREE" | "STARTER" | "PRO" | "ENTERPRISE";
        monthlyPrice: number;
        yearlyPrice: number;
        maxContacts: number;
        maxMessages: number;
        maxTeamMembers: number;
        maxCampaigns: number;
        maxChatbots: number;
        maxTemplates: number;
        description?: string | undefined;
        features?: string[] | undefined;
    };
}>;
export declare const updatePlanSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    body: z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        monthlyPrice: z.ZodOptional<z.ZodNumber>;
        yearlyPrice: z.ZodOptional<z.ZodNumber>;
        maxContacts: z.ZodOptional<z.ZodNumber>;
        maxMessages: z.ZodOptional<z.ZodNumber>;
        maxTeamMembers: z.ZodOptional<z.ZodNumber>;
        maxCampaigns: z.ZodOptional<z.ZodNumber>;
        maxChatbots: z.ZodOptional<z.ZodNumber>;
        maxTemplates: z.ZodOptional<z.ZodNumber>;
        features: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        isActive: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        name?: string | undefined;
        description?: string | null | undefined;
        monthlyPrice?: number | undefined;
        yearlyPrice?: number | undefined;
        maxContacts?: number | undefined;
        maxMessages?: number | undefined;
        maxTeamMembers?: number | undefined;
        maxCampaigns?: number | undefined;
        maxChatbots?: number | undefined;
        maxTemplates?: number | undefined;
        features?: string[] | undefined;
        isActive?: boolean | undefined;
    }, {
        name?: string | undefined;
        description?: string | null | undefined;
        monthlyPrice?: number | undefined;
        yearlyPrice?: number | undefined;
        maxContacts?: number | undefined;
        maxMessages?: number | undefined;
        maxTeamMembers?: number | undefined;
        maxCampaigns?: number | undefined;
        maxChatbots?: number | undefined;
        maxTemplates?: number | undefined;
        features?: string[] | undefined;
        isActive?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        id: string;
    };
    body: {
        name?: string | undefined;
        description?: string | null | undefined;
        monthlyPrice?: number | undefined;
        yearlyPrice?: number | undefined;
        maxContacts?: number | undefined;
        maxMessages?: number | undefined;
        maxTeamMembers?: number | undefined;
        maxCampaigns?: number | undefined;
        maxChatbots?: number | undefined;
        maxTemplates?: number | undefined;
        features?: string[] | undefined;
        isActive?: boolean | undefined;
    };
}, {
    params: {
        id: string;
    };
    body: {
        name?: string | undefined;
        description?: string | null | undefined;
        monthlyPrice?: number | undefined;
        yearlyPrice?: number | undefined;
        maxContacts?: number | undefined;
        maxMessages?: number | undefined;
        maxTeamMembers?: number | undefined;
        maxCampaigns?: number | undefined;
        maxChatbots?: number | undefined;
        maxTemplates?: number | undefined;
        features?: string[] | undefined;
        isActive?: boolean | undefined;
    };
}>;
export declare const updateSystemSettingsSchema: z.ZodObject<{
    body: z.ZodObject<{
        maintenanceMode: z.ZodOptional<z.ZodBoolean>;
        registrationEnabled: z.ZodOptional<z.ZodBoolean>;
        defaultPlan: z.ZodOptional<z.ZodNativeEnum<{
            FREE: "FREE";
            STARTER: "STARTER";
            PRO: "PRO";
            ENTERPRISE: "ENTERPRISE";
        }>>;
        maxOrganizationsPerUser: z.ZodOptional<z.ZodNumber>;
        maxContactsFreePlan: z.ZodOptional<z.ZodNumber>;
        maxMessagesFreePlan: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        maintenanceMode?: boolean | undefined;
        registrationEnabled?: boolean | undefined;
        defaultPlan?: "FREE" | "STARTER" | "PRO" | "ENTERPRISE" | undefined;
        maxOrganizationsPerUser?: number | undefined;
        maxContactsFreePlan?: number | undefined;
        maxMessagesFreePlan?: number | undefined;
    }, {
        maintenanceMode?: boolean | undefined;
        registrationEnabled?: boolean | undefined;
        defaultPlan?: "FREE" | "STARTER" | "PRO" | "ENTERPRISE" | undefined;
        maxOrganizationsPerUser?: number | undefined;
        maxContactsFreePlan?: number | undefined;
        maxMessagesFreePlan?: number | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        maintenanceMode?: boolean | undefined;
        registrationEnabled?: boolean | undefined;
        defaultPlan?: "FREE" | "STARTER" | "PRO" | "ENTERPRISE" | undefined;
        maxOrganizationsPerUser?: number | undefined;
        maxContactsFreePlan?: number | undefined;
        maxMessagesFreePlan?: number | undefined;
    };
}, {
    body: {
        maintenanceMode?: boolean | undefined;
        registrationEnabled?: boolean | undefined;
        defaultPlan?: "FREE" | "STARTER" | "PRO" | "ENTERPRISE" | undefined;
        maxOrganizationsPerUser?: number | undefined;
        maxContactsFreePlan?: number | undefined;
        maxMessagesFreePlan?: number | undefined;
    };
}>;
export declare const getActivityLogsSchema: z.ZodObject<{
    query: z.ZodObject<{
        page: z.ZodDefault<z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>>;
        limit: z.ZodDefault<z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>>;
        action: z.ZodOptional<z.ZodString>;
        userId: z.ZodOptional<z.ZodString>;
        organizationId: z.ZodOptional<z.ZodString>;
        startDate: z.ZodOptional<z.ZodString>;
        endDate: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        page: number;
        limit: number;
        userId?: string | undefined;
        organizationId?: string | undefined;
        action?: string | undefined;
        startDate?: string | undefined;
        endDate?: string | undefined;
    }, {
        page?: string | undefined;
        limit?: string | undefined;
        userId?: string | undefined;
        organizationId?: string | undefined;
        action?: string | undefined;
        startDate?: string | undefined;
        endDate?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        page: number;
        limit: number;
        userId?: string | undefined;
        organizationId?: string | undefined;
        action?: string | undefined;
        startDate?: string | undefined;
        endDate?: string | undefined;
    };
}, {
    query: {
        page?: string | undefined;
        limit?: string | undefined;
        userId?: string | undefined;
        organizationId?: string | undefined;
        action?: string | undefined;
        startDate?: string | undefined;
        endDate?: string | undefined;
    };
}>;
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
//# sourceMappingURL=admin.schema.d.ts.map