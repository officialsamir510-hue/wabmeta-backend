import { z } from 'zod';
declare const simpleButtonSchema: z.ZodObject<{
    type: z.ZodEnum<["QUICK_REPLY", "URL", "PHONE_NUMBER"]>;
    text: z.ZodString;
    url: z.ZodOptional<z.ZodString>;
    phoneNumber: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "URL" | "QUICK_REPLY" | "PHONE_NUMBER";
    text: string;
    phoneNumber?: string | undefined;
    url?: string | undefined;
}, {
    type: "URL" | "QUICK_REPLY" | "PHONE_NUMBER";
    text: string;
    phoneNumber?: string | undefined;
    url?: string | undefined;
}>;
declare const variableSchema: z.ZodObject<{
    index: z.ZodNumber;
    type: z.ZodDefault<z.ZodEnum<["text", "currency", "date_time", "image", "document", "video"]>>;
    example: z.ZodOptional<z.ZodString>;
    placeholder: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "text" | "document" | "image" | "video" | "currency" | "date_time";
    index: number;
    example?: string | undefined;
    placeholder?: string | undefined;
}, {
    index: number;
    type?: "text" | "document" | "image" | "video" | "currency" | "date_time" | undefined;
    example?: string | undefined;
    placeholder?: string | undefined;
}>;
export declare const createTemplateSchema: z.ZodObject<{
    body: z.ZodObject<{
        name: z.ZodString;
        language: z.ZodDefault<z.ZodString>;
        category: z.ZodNativeEnum<{
            MARKETING: "MARKETING";
            UTILITY: "UTILITY";
            AUTHENTICATION: "AUTHENTICATION";
        }>;
        headerType: z.ZodDefault<z.ZodOptional<z.ZodEnum<["NONE", "TEXT", "IMAGE", "VIDEO", "DOCUMENT"]>>>;
        headerContent: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        bodyText: z.ZodString;
        footerText: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        buttons: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
            type: z.ZodEnum<["QUICK_REPLY", "URL", "PHONE_NUMBER"]>;
            text: z.ZodString;
            url: z.ZodOptional<z.ZodString>;
            phoneNumber: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "URL" | "QUICK_REPLY" | "PHONE_NUMBER";
            text: string;
            phoneNumber?: string | undefined;
            url?: string | undefined;
        }, {
            type: "URL" | "QUICK_REPLY" | "PHONE_NUMBER";
            text: string;
            phoneNumber?: string | undefined;
            url?: string | undefined;
        }>, "many">>>;
        variables: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
            index: z.ZodNumber;
            type: z.ZodDefault<z.ZodEnum<["text", "currency", "date_time", "image", "document", "video"]>>;
            example: z.ZodOptional<z.ZodString>;
            placeholder: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "text" | "document" | "image" | "video" | "currency" | "date_time";
            index: number;
            example?: string | undefined;
            placeholder?: string | undefined;
        }, {
            index: number;
            type?: "text" | "document" | "image" | "video" | "currency" | "date_time" | undefined;
            example?: string | undefined;
            placeholder?: string | undefined;
        }>, "many">>>;
        whatsappAccountId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        language: string;
        category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
        headerType: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "NONE";
        bodyText: string;
        buttons: {
            type: "URL" | "QUICK_REPLY" | "PHONE_NUMBER";
            text: string;
            phoneNumber?: string | undefined;
            url?: string | undefined;
        }[];
        variables: {
            type: "text" | "document" | "image" | "video" | "currency" | "date_time";
            index: number;
            example?: string | undefined;
            placeholder?: string | undefined;
        }[];
        headerContent?: string | null | undefined;
        footerText?: string | null | undefined;
        whatsappAccountId?: string | undefined;
    }, {
        name: string;
        category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
        bodyText: string;
        language?: string | undefined;
        headerType?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "NONE" | undefined;
        headerContent?: string | null | undefined;
        footerText?: string | null | undefined;
        buttons?: {
            type: "URL" | "QUICK_REPLY" | "PHONE_NUMBER";
            text: string;
            phoneNumber?: string | undefined;
            url?: string | undefined;
        }[] | undefined;
        variables?: {
            index: number;
            type?: "text" | "document" | "image" | "video" | "currency" | "date_time" | undefined;
            example?: string | undefined;
            placeholder?: string | undefined;
        }[] | undefined;
        whatsappAccountId?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        name: string;
        language: string;
        category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
        headerType: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "NONE";
        bodyText: string;
        buttons: {
            type: "URL" | "QUICK_REPLY" | "PHONE_NUMBER";
            text: string;
            phoneNumber?: string | undefined;
            url?: string | undefined;
        }[];
        variables: {
            type: "text" | "document" | "image" | "video" | "currency" | "date_time";
            index: number;
            example?: string | undefined;
            placeholder?: string | undefined;
        }[];
        headerContent?: string | null | undefined;
        footerText?: string | null | undefined;
        whatsappAccountId?: string | undefined;
    };
}, {
    body: {
        name: string;
        category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
        bodyText: string;
        language?: string | undefined;
        headerType?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "NONE" | undefined;
        headerContent?: string | null | undefined;
        footerText?: string | null | undefined;
        buttons?: {
            type: "URL" | "QUICK_REPLY" | "PHONE_NUMBER";
            text: string;
            phoneNumber?: string | undefined;
            url?: string | undefined;
        }[] | undefined;
        variables?: {
            index: number;
            type?: "text" | "document" | "image" | "video" | "currency" | "date_time" | undefined;
            example?: string | undefined;
            placeholder?: string | undefined;
        }[] | undefined;
        whatsappAccountId?: string | undefined;
    };
}>;
export declare const updateTemplateSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    body: z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        language: z.ZodOptional<z.ZodString>;
        category: z.ZodOptional<z.ZodNativeEnum<{
            MARKETING: "MARKETING";
            UTILITY: "UTILITY";
            AUTHENTICATION: "AUTHENTICATION";
        }>>;
        headerType: z.ZodNullable<z.ZodOptional<z.ZodEnum<["NONE", "TEXT", "IMAGE", "VIDEO", "DOCUMENT"]>>>;
        headerContent: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        bodyText: z.ZodOptional<z.ZodString>;
        footerText: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        buttons: z.ZodOptional<z.ZodArray<z.ZodObject<{
            type: z.ZodEnum<["QUICK_REPLY", "URL", "PHONE_NUMBER"]>;
            text: z.ZodString;
            url: z.ZodOptional<z.ZodString>;
            phoneNumber: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "URL" | "QUICK_REPLY" | "PHONE_NUMBER";
            text: string;
            phoneNumber?: string | undefined;
            url?: string | undefined;
        }, {
            type: "URL" | "QUICK_REPLY" | "PHONE_NUMBER";
            text: string;
            phoneNumber?: string | undefined;
            url?: string | undefined;
        }>, "many">>;
        variables: z.ZodOptional<z.ZodArray<z.ZodObject<{
            index: z.ZodNumber;
            type: z.ZodDefault<z.ZodEnum<["text", "currency", "date_time", "image", "document", "video"]>>;
            example: z.ZodOptional<z.ZodString>;
            placeholder: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "text" | "document" | "image" | "video" | "currency" | "date_time";
            index: number;
            example?: string | undefined;
            placeholder?: string | undefined;
        }, {
            index: number;
            type?: "text" | "document" | "image" | "video" | "currency" | "date_time" | undefined;
            example?: string | undefined;
            placeholder?: string | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        name?: string | undefined;
        language?: string | undefined;
        category?: "MARKETING" | "UTILITY" | "AUTHENTICATION" | undefined;
        headerType?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "NONE" | null | undefined;
        headerContent?: string | null | undefined;
        bodyText?: string | undefined;
        footerText?: string | null | undefined;
        buttons?: {
            type: "URL" | "QUICK_REPLY" | "PHONE_NUMBER";
            text: string;
            phoneNumber?: string | undefined;
            url?: string | undefined;
        }[] | undefined;
        variables?: {
            type: "text" | "document" | "image" | "video" | "currency" | "date_time";
            index: number;
            example?: string | undefined;
            placeholder?: string | undefined;
        }[] | undefined;
    }, {
        name?: string | undefined;
        language?: string | undefined;
        category?: "MARKETING" | "UTILITY" | "AUTHENTICATION" | undefined;
        headerType?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "NONE" | null | undefined;
        headerContent?: string | null | undefined;
        bodyText?: string | undefined;
        footerText?: string | null | undefined;
        buttons?: {
            type: "URL" | "QUICK_REPLY" | "PHONE_NUMBER";
            text: string;
            phoneNumber?: string | undefined;
            url?: string | undefined;
        }[] | undefined;
        variables?: {
            index: number;
            type?: "text" | "document" | "image" | "video" | "currency" | "date_time" | undefined;
            example?: string | undefined;
            placeholder?: string | undefined;
        }[] | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        id: string;
    };
    body: {
        name?: string | undefined;
        language?: string | undefined;
        category?: "MARKETING" | "UTILITY" | "AUTHENTICATION" | undefined;
        headerType?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "NONE" | null | undefined;
        headerContent?: string | null | undefined;
        bodyText?: string | undefined;
        footerText?: string | null | undefined;
        buttons?: {
            type: "URL" | "QUICK_REPLY" | "PHONE_NUMBER";
            text: string;
            phoneNumber?: string | undefined;
            url?: string | undefined;
        }[] | undefined;
        variables?: {
            type: "text" | "document" | "image" | "video" | "currency" | "date_time";
            index: number;
            example?: string | undefined;
            placeholder?: string | undefined;
        }[] | undefined;
    };
}, {
    params: {
        id: string;
    };
    body: {
        name?: string | undefined;
        language?: string | undefined;
        category?: "MARKETING" | "UTILITY" | "AUTHENTICATION" | undefined;
        headerType?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "NONE" | null | undefined;
        headerContent?: string | null | undefined;
        bodyText?: string | undefined;
        footerText?: string | null | undefined;
        buttons?: {
            type: "URL" | "QUICK_REPLY" | "PHONE_NUMBER";
            text: string;
            phoneNumber?: string | undefined;
            url?: string | undefined;
        }[] | undefined;
        variables?: {
            index: number;
            type?: "text" | "document" | "image" | "video" | "currency" | "date_time" | undefined;
            example?: string | undefined;
            placeholder?: string | undefined;
        }[] | undefined;
    };
}>;
export declare const getTemplatesSchema: z.ZodObject<{
    query: z.ZodObject<{
        page: z.ZodEffects<z.ZodDefault<z.ZodOptional<z.ZodString>>, number, string | undefined>;
        limit: z.ZodEffects<z.ZodDefault<z.ZodOptional<z.ZodString>>, number, string | undefined>;
        search: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
        status: z.ZodOptional<z.ZodNativeEnum<{
            PENDING: "PENDING";
            APPROVED: "APPROVED";
            REJECTED: "REJECTED";
        }>>;
        category: z.ZodOptional<z.ZodNativeEnum<{
            MARKETING: "MARKETING";
            UTILITY: "UTILITY";
            AUTHENTICATION: "AUTHENTICATION";
        }>>;
        language: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
        sortBy: z.ZodDefault<z.ZodOptional<z.ZodEnum<["createdAt", "updatedAt", "name", "status"]>>>;
        sortOrder: z.ZodDefault<z.ZodOptional<z.ZodEnum<["asc", "desc"]>>>;
        whatsappAccountId: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        page: z.ZodEffects<z.ZodDefault<z.ZodOptional<z.ZodString>>, number, string | undefined>;
        limit: z.ZodEffects<z.ZodDefault<z.ZodOptional<z.ZodString>>, number, string | undefined>;
        search: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
        status: z.ZodOptional<z.ZodNativeEnum<{
            PENDING: "PENDING";
            APPROVED: "APPROVED";
            REJECTED: "REJECTED";
        }>>;
        category: z.ZodOptional<z.ZodNativeEnum<{
            MARKETING: "MARKETING";
            UTILITY: "UTILITY";
            AUTHENTICATION: "AUTHENTICATION";
        }>>;
        language: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
        sortBy: z.ZodDefault<z.ZodOptional<z.ZodEnum<["createdAt", "updatedAt", "name", "status"]>>>;
        sortOrder: z.ZodDefault<z.ZodOptional<z.ZodEnum<["asc", "desc"]>>>;
        whatsappAccountId: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        page: z.ZodEffects<z.ZodDefault<z.ZodOptional<z.ZodString>>, number, string | undefined>;
        limit: z.ZodEffects<z.ZodDefault<z.ZodOptional<z.ZodString>>, number, string | undefined>;
        search: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
        status: z.ZodOptional<z.ZodNativeEnum<{
            PENDING: "PENDING";
            APPROVED: "APPROVED";
            REJECTED: "REJECTED";
        }>>;
        category: z.ZodOptional<z.ZodNativeEnum<{
            MARKETING: "MARKETING";
            UTILITY: "UTILITY";
            AUTHENTICATION: "AUTHENTICATION";
        }>>;
        language: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
        sortBy: z.ZodDefault<z.ZodOptional<z.ZodEnum<["createdAt", "updatedAt", "name", "status"]>>>;
        sortOrder: z.ZodDefault<z.ZodOptional<z.ZodEnum<["asc", "desc"]>>>;
        whatsappAccountId: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
    }, z.ZodTypeAny, "passthrough">>;
}, "strip", z.ZodTypeAny, {
    query: {
        page: number;
        limit: number;
        sortBy: "name" | "status" | "createdAt" | "updatedAt";
        sortOrder: "desc" | "asc";
        search?: string | undefined;
        status?: "PENDING" | "APPROVED" | "REJECTED" | undefined;
        language?: string | undefined;
        category?: "MARKETING" | "UTILITY" | "AUTHENTICATION" | undefined;
        whatsappAccountId?: string | undefined;
    } & {
        [k: string]: unknown;
    };
}, {
    query: {
        search?: string | undefined;
        page?: string | undefined;
        limit?: string | undefined;
        status?: "PENDING" | "APPROVED" | "REJECTED" | undefined;
        language?: string | undefined;
        category?: "MARKETING" | "UTILITY" | "AUTHENTICATION" | undefined;
        whatsappAccountId?: string | undefined;
        sortBy?: "name" | "status" | "createdAt" | "updatedAt" | undefined;
        sortOrder?: "desc" | "asc" | undefined;
    } & {
        [k: string]: unknown;
    };
}>;
export declare const getTemplateByIdSchema: z.ZodObject<{
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
export declare const deleteTemplateSchema: z.ZodObject<{
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
export declare const duplicateTemplateSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    body: z.ZodObject<{
        name: z.ZodString;
        whatsappAccountId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        whatsappAccountId?: string | undefined;
    }, {
        name: string;
        whatsappAccountId?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        id: string;
    };
    body: {
        name: string;
        whatsappAccountId?: string | undefined;
    };
}, {
    params: {
        id: string;
    };
    body: {
        name: string;
        whatsappAccountId?: string | undefined;
    };
}>;
export declare const submitTemplateSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    body: z.ZodOptional<z.ZodObject<{
        whatsappAccountId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        whatsappAccountId?: string | undefined;
    }, {
        whatsappAccountId?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    params: {
        id: string;
    };
    body?: {
        whatsappAccountId?: string | undefined;
    } | undefined;
}, {
    params: {
        id: string;
    };
    body?: {
        whatsappAccountId?: string | undefined;
    } | undefined;
}>;
export declare const previewTemplateSchema: z.ZodObject<{
    body: z.ZodObject<{
        headerType: z.ZodOptional<z.ZodEnum<["NONE", "TEXT", "IMAGE", "VIDEO", "DOCUMENT"]>>;
        headerContent: z.ZodOptional<z.ZodString>;
        bodyText: z.ZodString;
        footerText: z.ZodOptional<z.ZodString>;
        buttons: z.ZodOptional<z.ZodArray<z.ZodObject<{
            type: z.ZodEnum<["QUICK_REPLY", "URL", "PHONE_NUMBER"]>;
            text: z.ZodString;
            url: z.ZodOptional<z.ZodString>;
            phoneNumber: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "URL" | "QUICK_REPLY" | "PHONE_NUMBER";
            text: string;
            phoneNumber?: string | undefined;
            url?: string | undefined;
        }, {
            type: "URL" | "QUICK_REPLY" | "PHONE_NUMBER";
            text: string;
            phoneNumber?: string | undefined;
            url?: string | undefined;
        }>, "many">>;
        variables: z.ZodDefault<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>>;
    }, "strip", z.ZodTypeAny, {
        bodyText: string;
        variables: Record<string, string>;
        headerType?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "NONE" | undefined;
        headerContent?: string | undefined;
        footerText?: string | undefined;
        buttons?: {
            type: "URL" | "QUICK_REPLY" | "PHONE_NUMBER";
            text: string;
            phoneNumber?: string | undefined;
            url?: string | undefined;
        }[] | undefined;
    }, {
        bodyText: string;
        headerType?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "NONE" | undefined;
        headerContent?: string | undefined;
        footerText?: string | undefined;
        buttons?: {
            type: "URL" | "QUICK_REPLY" | "PHONE_NUMBER";
            text: string;
            phoneNumber?: string | undefined;
            url?: string | undefined;
        }[] | undefined;
        variables?: Record<string, string> | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        bodyText: string;
        variables: Record<string, string>;
        headerType?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "NONE" | undefined;
        headerContent?: string | undefined;
        footerText?: string | undefined;
        buttons?: {
            type: "URL" | "QUICK_REPLY" | "PHONE_NUMBER";
            text: string;
            phoneNumber?: string | undefined;
            url?: string | undefined;
        }[] | undefined;
    };
}, {
    body: {
        bodyText: string;
        headerType?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "NONE" | undefined;
        headerContent?: string | undefined;
        footerText?: string | undefined;
        buttons?: {
            type: "URL" | "QUICK_REPLY" | "PHONE_NUMBER";
            text: string;
            phoneNumber?: string | undefined;
            url?: string | undefined;
        }[] | undefined;
        variables?: Record<string, string> | undefined;
    };
}>;
export declare const syncTemplatesSchema: z.ZodObject<{
    body: z.ZodDefault<z.ZodOptional<z.ZodObject<{
        whatsappAccountId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        whatsappAccountId?: string | undefined;
    }, {
        whatsappAccountId?: string | undefined;
    }>>>;
}, "strip", z.ZodTypeAny, {
    body: {
        whatsappAccountId?: string | undefined;
    };
}, {
    body?: {
        whatsappAccountId?: string | undefined;
    } | undefined;
}>;
export declare const getApprovedTemplatesSchema: z.ZodObject<{
    query: z.ZodObject<{
        whatsappAccountId: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        whatsappAccountId: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        whatsappAccountId: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
    }, z.ZodTypeAny, "passthrough">>;
}, "strip", z.ZodTypeAny, {
    query: {
        whatsappAccountId?: string | undefined;
    } & {
        [k: string]: unknown;
    };
}, {
    query: {
        whatsappAccountId?: string | undefined;
    } & {
        [k: string]: unknown;
    };
}>;
export declare const getLanguagesSchema: z.ZodObject<{
    query: z.ZodObject<{
        whatsappAccountId: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        whatsappAccountId: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        whatsappAccountId: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
    }, z.ZodTypeAny, "passthrough">>;
}, "strip", z.ZodTypeAny, {
    query: {
        whatsappAccountId?: string | undefined;
    } & {
        [k: string]: unknown;
    };
}, {
    query: {
        whatsappAccountId?: string | undefined;
    } & {
        [k: string]: unknown;
    };
}>;
export declare const getStatsSchema: z.ZodObject<{
    query: z.ZodObject<{
        whatsappAccountId: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        whatsappAccountId: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        whatsappAccountId: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
    }, z.ZodTypeAny, "passthrough">>;
}, "strip", z.ZodTypeAny, {
    query: {
        whatsappAccountId?: string | undefined;
    } & {
        [k: string]: unknown;
    };
}, {
    query: {
        whatsappAccountId?: string | undefined;
    } & {
        [k: string]: unknown;
    };
}>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>['body'];
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>['body'];
export type GetTemplatesInput = z.infer<typeof getTemplatesSchema>['query'];
export type DuplicateTemplateInput = z.infer<typeof duplicateTemplateSchema>['body'];
export type SubmitTemplateInput = z.infer<typeof submitTemplateSchema>;
export type PreviewTemplateInput = z.infer<typeof previewTemplateSchema>['body'];
export type SyncTemplatesInput = z.infer<typeof syncTemplatesSchema>;
export type TemplateButton = z.infer<typeof simpleButtonSchema>;
export type TemplateVariable = z.infer<typeof variableSchema>;
export type CreateTemplateSchema = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateSchema = z.infer<typeof updateTemplateSchema>;
export type GetTemplatesSchema = z.infer<typeof getTemplatesSchema>;
export type DuplicateTemplateSchema = z.infer<typeof duplicateTemplateSchema>;
export type SubmitTemplateSchema = z.infer<typeof submitTemplateSchema>;
export type PreviewTemplateSchema = z.infer<typeof previewTemplateSchema>;
export {};
//# sourceMappingURL=templates.schema.d.ts.map