import { z } from 'zod';
export declare const createCampaignSchema: z.ZodObject<{
    body: z.ZodEffects<z.ZodObject<{
        name: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        templateId: z.ZodString;
        whatsappAccountId: z.ZodString;
        contactGroupId: z.ZodOptional<z.ZodString>;
        contactIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        audienceFilter: z.ZodOptional<z.ZodObject<{
            tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            status: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            createdAfter: z.ZodOptional<z.ZodString>;
            createdBefore: z.ZodOptional<z.ZodString>;
            hasMessaged: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            status?: string[] | undefined;
            tags?: string[] | undefined;
            createdAfter?: string | undefined;
            createdBefore?: string | undefined;
            hasMessaged?: boolean | undefined;
        }, {
            status?: string[] | undefined;
            tags?: string[] | undefined;
            createdAfter?: string | undefined;
            createdBefore?: string | undefined;
            hasMessaged?: boolean | undefined;
        }>>;
        scheduledAt: z.ZodOptional<z.ZodString>;
        variableMapping: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
            type: z.ZodEnum<["field", "static"]>;
            value: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            type: "field" | "static";
            value: string;
        }, {
            type: "field" | "static";
            value: string;
        }>>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        templateId: string;
        whatsappAccountId: string;
        description?: string | undefined;
        contactGroupId?: string | undefined;
        audienceFilter?: {
            status?: string[] | undefined;
            tags?: string[] | undefined;
            createdAfter?: string | undefined;
            createdBefore?: string | undefined;
            hasMessaged?: boolean | undefined;
        } | undefined;
        scheduledAt?: string | undefined;
        contactIds?: string[] | undefined;
        variableMapping?: Record<string, {
            type: "field" | "static";
            value: string;
        }> | undefined;
    }, {
        name: string;
        templateId: string;
        whatsappAccountId: string;
        description?: string | undefined;
        contactGroupId?: string | undefined;
        audienceFilter?: {
            status?: string[] | undefined;
            tags?: string[] | undefined;
            createdAfter?: string | undefined;
            createdBefore?: string | undefined;
            hasMessaged?: boolean | undefined;
        } | undefined;
        scheduledAt?: string | undefined;
        contactIds?: string[] | undefined;
        variableMapping?: Record<string, {
            type: "field" | "static";
            value: string;
        }> | undefined;
    }>, {
        name: string;
        templateId: string;
        whatsappAccountId: string;
        description?: string | undefined;
        contactGroupId?: string | undefined;
        audienceFilter?: {
            status?: string[] | undefined;
            tags?: string[] | undefined;
            createdAfter?: string | undefined;
            createdBefore?: string | undefined;
            hasMessaged?: boolean | undefined;
        } | undefined;
        scheduledAt?: string | undefined;
        contactIds?: string[] | undefined;
        variableMapping?: Record<string, {
            type: "field" | "static";
            value: string;
        }> | undefined;
    }, {
        name: string;
        templateId: string;
        whatsappAccountId: string;
        description?: string | undefined;
        contactGroupId?: string | undefined;
        audienceFilter?: {
            status?: string[] | undefined;
            tags?: string[] | undefined;
            createdAfter?: string | undefined;
            createdBefore?: string | undefined;
            hasMessaged?: boolean | undefined;
        } | undefined;
        scheduledAt?: string | undefined;
        contactIds?: string[] | undefined;
        variableMapping?: Record<string, {
            type: "field" | "static";
            value: string;
        }> | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        name: string;
        templateId: string;
        whatsappAccountId: string;
        description?: string | undefined;
        contactGroupId?: string | undefined;
        audienceFilter?: {
            status?: string[] | undefined;
            tags?: string[] | undefined;
            createdAfter?: string | undefined;
            createdBefore?: string | undefined;
            hasMessaged?: boolean | undefined;
        } | undefined;
        scheduledAt?: string | undefined;
        contactIds?: string[] | undefined;
        variableMapping?: Record<string, {
            type: "field" | "static";
            value: string;
        }> | undefined;
    };
}, {
    body: {
        name: string;
        templateId: string;
        whatsappAccountId: string;
        description?: string | undefined;
        contactGroupId?: string | undefined;
        audienceFilter?: {
            status?: string[] | undefined;
            tags?: string[] | undefined;
            createdAfter?: string | undefined;
            createdBefore?: string | undefined;
            hasMessaged?: boolean | undefined;
        } | undefined;
        scheduledAt?: string | undefined;
        contactIds?: string[] | undefined;
        variableMapping?: Record<string, {
            type: "field" | "static";
            value: string;
        }> | undefined;
    };
}>;
export declare const updateCampaignSchema: z.ZodObject<{
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
        templateId: z.ZodOptional<z.ZodString>;
        contactGroupId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        contactIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        audienceFilter: z.ZodOptional<z.ZodObject<{
            tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            status: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            createdAfter: z.ZodOptional<z.ZodString>;
            createdBefore: z.ZodOptional<z.ZodString>;
            hasMessaged: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            status?: string[] | undefined;
            tags?: string[] | undefined;
            createdAfter?: string | undefined;
            createdBefore?: string | undefined;
            hasMessaged?: boolean | undefined;
        }, {
            status?: string[] | undefined;
            tags?: string[] | undefined;
            createdAfter?: string | undefined;
            createdBefore?: string | undefined;
            hasMessaged?: boolean | undefined;
        }>>;
        scheduledAt: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        variableMapping: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
            type: z.ZodEnum<["field", "static"]>;
            value: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            type: "field" | "static";
            value: string;
        }, {
            type: "field" | "static";
            value: string;
        }>>>;
    }, "strip", z.ZodTypeAny, {
        name?: string | undefined;
        description?: string | null | undefined;
        templateId?: string | undefined;
        contactGroupId?: string | null | undefined;
        audienceFilter?: {
            status?: string[] | undefined;
            tags?: string[] | undefined;
            createdAfter?: string | undefined;
            createdBefore?: string | undefined;
            hasMessaged?: boolean | undefined;
        } | undefined;
        scheduledAt?: string | null | undefined;
        contactIds?: string[] | undefined;
        variableMapping?: Record<string, {
            type: "field" | "static";
            value: string;
        }> | undefined;
    }, {
        name?: string | undefined;
        description?: string | null | undefined;
        templateId?: string | undefined;
        contactGroupId?: string | null | undefined;
        audienceFilter?: {
            status?: string[] | undefined;
            tags?: string[] | undefined;
            createdAfter?: string | undefined;
            createdBefore?: string | undefined;
            hasMessaged?: boolean | undefined;
        } | undefined;
        scheduledAt?: string | null | undefined;
        contactIds?: string[] | undefined;
        variableMapping?: Record<string, {
            type: "field" | "static";
            value: string;
        }> | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        id: string;
    };
    body: {
        name?: string | undefined;
        description?: string | null | undefined;
        templateId?: string | undefined;
        contactGroupId?: string | null | undefined;
        audienceFilter?: {
            status?: string[] | undefined;
            tags?: string[] | undefined;
            createdAfter?: string | undefined;
            createdBefore?: string | undefined;
            hasMessaged?: boolean | undefined;
        } | undefined;
        scheduledAt?: string | null | undefined;
        contactIds?: string[] | undefined;
        variableMapping?: Record<string, {
            type: "field" | "static";
            value: string;
        }> | undefined;
    };
}, {
    params: {
        id: string;
    };
    body: {
        name?: string | undefined;
        description?: string | null | undefined;
        templateId?: string | undefined;
        contactGroupId?: string | null | undefined;
        audienceFilter?: {
            status?: string[] | undefined;
            tags?: string[] | undefined;
            createdAfter?: string | undefined;
            createdBefore?: string | undefined;
            hasMessaged?: boolean | undefined;
        } | undefined;
        scheduledAt?: string | null | undefined;
        contactIds?: string[] | undefined;
        variableMapping?: Record<string, {
            type: "field" | "static";
            value: string;
        }> | undefined;
    };
}>;
export declare const getCampaignsSchema: z.ZodObject<{
    query: z.ZodObject<{
        page: z.ZodDefault<z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>>;
        limit: z.ZodDefault<z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>>;
        search: z.ZodOptional<z.ZodString>;
        status: z.ZodOptional<z.ZodNativeEnum<{
            DRAFT: "DRAFT";
            SCHEDULED: "SCHEDULED";
            RUNNING: "RUNNING";
            PAUSED: "PAUSED";
            COMPLETED: "COMPLETED";
            FAILED: "FAILED";
        }>>;
        sortBy: z.ZodDefault<z.ZodOptional<z.ZodEnum<["createdAt", "name", "scheduledAt", "sentCount"]>>>;
        sortOrder: z.ZodDefault<z.ZodOptional<z.ZodEnum<["asc", "desc"]>>>;
    }, "strip", z.ZodTypeAny, {
        page: number;
        limit: number;
        sortBy: "name" | "createdAt" | "scheduledAt" | "sentCount";
        sortOrder: "desc" | "asc";
        search?: string | undefined;
        status?: "COMPLETED" | "DRAFT" | "PAUSED" | "FAILED" | "SCHEDULED" | "RUNNING" | undefined;
    }, {
        search?: string | undefined;
        status?: "COMPLETED" | "DRAFT" | "PAUSED" | "FAILED" | "SCHEDULED" | "RUNNING" | undefined;
        page?: string | undefined;
        limit?: string | undefined;
        sortBy?: "name" | "createdAt" | "scheduledAt" | "sentCount" | undefined;
        sortOrder?: "desc" | "asc" | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        page: number;
        limit: number;
        sortBy: "name" | "createdAt" | "scheduledAt" | "sentCount";
        sortOrder: "desc" | "asc";
        search?: string | undefined;
        status?: "COMPLETED" | "DRAFT" | "PAUSED" | "FAILED" | "SCHEDULED" | "RUNNING" | undefined;
    };
}, {
    query: {
        search?: string | undefined;
        status?: "COMPLETED" | "DRAFT" | "PAUSED" | "FAILED" | "SCHEDULED" | "RUNNING" | undefined;
        page?: string | undefined;
        limit?: string | undefined;
        sortBy?: "name" | "createdAt" | "scheduledAt" | "sentCount" | undefined;
        sortOrder?: "desc" | "asc" | undefined;
    };
}>;
export declare const getCampaignByIdSchema: z.ZodObject<{
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
export declare const deleteCampaignSchema: z.ZodObject<{
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
export declare const getCampaignContactsSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    query: z.ZodObject<{
        page: z.ZodDefault<z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>>;
        limit: z.ZodDefault<z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>>;
        status: z.ZodOptional<z.ZodNativeEnum<{
            PENDING: "PENDING";
            SENT: "SENT";
            DELIVERED: "DELIVERED";
            READ: "READ";
            FAILED: "FAILED";
        }>>;
    }, "strip", z.ZodTypeAny, {
        page: number;
        limit: number;
        status?: "PENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED" | undefined;
    }, {
        status?: "PENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED" | undefined;
        page?: string | undefined;
        limit?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        page: number;
        limit: number;
        status?: "PENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED" | undefined;
    };
    params: {
        id: string;
    };
}, {
    query: {
        status?: "PENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED" | undefined;
        page?: string | undefined;
        limit?: string | undefined;
    };
    params: {
        id: string;
    };
}>;
export declare const startCampaignSchema: z.ZodObject<{
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
export declare const pauseCampaignSchema: z.ZodObject<{
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
export declare const resumeCampaignSchema: z.ZodObject<{
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
export declare const cancelCampaignSchema: z.ZodObject<{
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
export declare const retryCampaignSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    body: z.ZodObject<{
        retryFailed: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        retryPending: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, "strip", z.ZodTypeAny, {
        retryFailed: boolean;
        retryPending: boolean;
    }, {
        retryFailed?: boolean | undefined;
        retryPending?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        id: string;
    };
    body: {
        retryFailed: boolean;
        retryPending: boolean;
    };
}, {
    params: {
        id: string;
    };
    body: {
        retryFailed?: boolean | undefined;
        retryPending?: boolean | undefined;
    };
}>;
export declare const duplicateCampaignSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    body: z.ZodObject<{
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
    }, {
        name: string;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        id: string;
    };
    body: {
        name: string;
    };
}, {
    params: {
        id: string;
    };
    body: {
        name: string;
    };
}>;
export type CreateCampaignSchema = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignSchema = z.infer<typeof updateCampaignSchema>;
export type GetCampaignsSchema = z.infer<typeof getCampaignsSchema>;
export type GetCampaignContactsSchema = z.infer<typeof getCampaignContactsSchema>;
export type RetryCampaignSchema = z.infer<typeof retryCampaignSchema>;
export type DuplicateCampaignSchema = z.infer<typeof duplicateCampaignSchema>;
//# sourceMappingURL=campaigns.schema.d.ts.map