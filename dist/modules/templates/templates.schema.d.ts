import { z } from 'zod';
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
        headerContent: z.ZodOptional<z.ZodString>;
        bodyText: z.ZodString;
        footerText: z.ZodOptional<z.ZodString>;
        buttons: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
            type: z.ZodLiteral<"QUICK_REPLY">;
            text: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            type: "QUICK_REPLY";
            text: string;
        }, {
            type: "QUICK_REPLY";
            text: string;
        }>, z.ZodObject<{
            type: z.ZodLiteral<"URL">;
            text: z.ZodString;
            url: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            type: "URL";
            url: string;
            text: string;
        }, {
            type: "URL";
            url: string;
            text: string;
        }>, z.ZodObject<{
            type: z.ZodLiteral<"PHONE_NUMBER">;
            text: z.ZodString;
            phoneNumber: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            phoneNumber: string;
            type: "PHONE_NUMBER";
            text: string;
        }, {
            phoneNumber: string;
            type: "PHONE_NUMBER";
            text: string;
        }>]>, "many">>>;
        variables: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
            index: z.ZodNumber;
            type: z.ZodEnum<["text", "currency", "date_time", "image", "document", "video"]>;
            example: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "text" | "image" | "document" | "video" | "currency" | "date_time";
            index: number;
            example?: string | undefined;
        }, {
            type: "text" | "image" | "document" | "video" | "currency" | "date_time";
            index: number;
            example?: string | undefined;
        }>, "many">>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        language: string;
        category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
        headerType: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "NONE";
        bodyText: string;
        buttons: ({
            type: "QUICK_REPLY";
            text: string;
        } | {
            type: "URL";
            url: string;
            text: string;
        } | {
            phoneNumber: string;
            type: "PHONE_NUMBER";
            text: string;
        })[];
        variables: {
            type: "text" | "image" | "document" | "video" | "currency" | "date_time";
            index: number;
            example?: string | undefined;
        }[];
        headerContent?: string | undefined;
        footerText?: string | undefined;
    }, {
        name: string;
        category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
        bodyText: string;
        language?: string | undefined;
        headerType?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "NONE" | undefined;
        headerContent?: string | undefined;
        footerText?: string | undefined;
        buttons?: ({
            type: "QUICK_REPLY";
            text: string;
        } | {
            type: "URL";
            url: string;
            text: string;
        } | {
            phoneNumber: string;
            type: "PHONE_NUMBER";
            text: string;
        })[] | undefined;
        variables?: {
            type: "text" | "image" | "document" | "video" | "currency" | "date_time";
            index: number;
            example?: string | undefined;
        }[] | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        name: string;
        language: string;
        category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
        headerType: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "NONE";
        bodyText: string;
        buttons: ({
            type: "QUICK_REPLY";
            text: string;
        } | {
            type: "URL";
            url: string;
            text: string;
        } | {
            phoneNumber: string;
            type: "PHONE_NUMBER";
            text: string;
        })[];
        variables: {
            type: "text" | "image" | "document" | "video" | "currency" | "date_time";
            index: number;
            example?: string | undefined;
        }[];
        headerContent?: string | undefined;
        footerText?: string | undefined;
    };
}, {
    body: {
        name: string;
        category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
        bodyText: string;
        language?: string | undefined;
        headerType?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "NONE" | undefined;
        headerContent?: string | undefined;
        footerText?: string | undefined;
        buttons?: ({
            type: "QUICK_REPLY";
            text: string;
        } | {
            type: "URL";
            url: string;
            text: string;
        } | {
            phoneNumber: string;
            type: "PHONE_NUMBER";
            text: string;
        })[] | undefined;
        variables?: {
            type: "text" | "image" | "document" | "video" | "currency" | "date_time";
            index: number;
            example?: string | undefined;
        }[] | undefined;
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
        headerType: z.ZodOptional<z.ZodEnum<["NONE", "TEXT", "IMAGE", "VIDEO", "DOCUMENT"]>>;
        headerContent: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        bodyText: z.ZodOptional<z.ZodString>;
        footerText: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        buttons: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
            type: z.ZodLiteral<"QUICK_REPLY">;
            text: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            type: "QUICK_REPLY";
            text: string;
        }, {
            type: "QUICK_REPLY";
            text: string;
        }>, z.ZodObject<{
            type: z.ZodLiteral<"URL">;
            text: z.ZodString;
            url: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            type: "URL";
            url: string;
            text: string;
        }, {
            type: "URL";
            url: string;
            text: string;
        }>, z.ZodObject<{
            type: z.ZodLiteral<"PHONE_NUMBER">;
            text: z.ZodString;
            phoneNumber: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            phoneNumber: string;
            type: "PHONE_NUMBER";
            text: string;
        }, {
            phoneNumber: string;
            type: "PHONE_NUMBER";
            text: string;
        }>]>, "many">>;
        variables: z.ZodOptional<z.ZodArray<z.ZodObject<{
            index: z.ZodNumber;
            type: z.ZodEnum<["text", "currency", "date_time", "image", "document", "video"]>;
            example: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "text" | "image" | "document" | "video" | "currency" | "date_time";
            index: number;
            example?: string | undefined;
        }, {
            type: "text" | "image" | "document" | "video" | "currency" | "date_time";
            index: number;
            example?: string | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        name?: string | undefined;
        language?: string | undefined;
        category?: "MARKETING" | "UTILITY" | "AUTHENTICATION" | undefined;
        headerType?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "NONE" | undefined;
        headerContent?: string | null | undefined;
        bodyText?: string | undefined;
        footerText?: string | null | undefined;
        buttons?: ({
            type: "QUICK_REPLY";
            text: string;
        } | {
            type: "URL";
            url: string;
            text: string;
        } | {
            phoneNumber: string;
            type: "PHONE_NUMBER";
            text: string;
        })[] | undefined;
        variables?: {
            type: "text" | "image" | "document" | "video" | "currency" | "date_time";
            index: number;
            example?: string | undefined;
        }[] | undefined;
    }, {
        name?: string | undefined;
        language?: string | undefined;
        category?: "MARKETING" | "UTILITY" | "AUTHENTICATION" | undefined;
        headerType?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "NONE" | undefined;
        headerContent?: string | null | undefined;
        bodyText?: string | undefined;
        footerText?: string | null | undefined;
        buttons?: ({
            type: "QUICK_REPLY";
            text: string;
        } | {
            type: "URL";
            url: string;
            text: string;
        } | {
            phoneNumber: string;
            type: "PHONE_NUMBER";
            text: string;
        })[] | undefined;
        variables?: {
            type: "text" | "image" | "document" | "video" | "currency" | "date_time";
            index: number;
            example?: string | undefined;
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
        headerType?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "NONE" | undefined;
        headerContent?: string | null | undefined;
        bodyText?: string | undefined;
        footerText?: string | null | undefined;
        buttons?: ({
            type: "QUICK_REPLY";
            text: string;
        } | {
            type: "URL";
            url: string;
            text: string;
        } | {
            phoneNumber: string;
            type: "PHONE_NUMBER";
            text: string;
        })[] | undefined;
        variables?: {
            type: "text" | "image" | "document" | "video" | "currency" | "date_time";
            index: number;
            example?: string | undefined;
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
        headerType?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "NONE" | undefined;
        headerContent?: string | null | undefined;
        bodyText?: string | undefined;
        footerText?: string | null | undefined;
        buttons?: ({
            type: "QUICK_REPLY";
            text: string;
        } | {
            type: "URL";
            url: string;
            text: string;
        } | {
            phoneNumber: string;
            type: "PHONE_NUMBER";
            text: string;
        })[] | undefined;
        variables?: {
            type: "text" | "image" | "document" | "video" | "currency" | "date_time";
            index: number;
            example?: string | undefined;
        }[] | undefined;
    };
}>;
export declare const getTemplatesSchema: z.ZodObject<{
    query: z.ZodObject<{
        page: z.ZodDefault<z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>>;
        limit: z.ZodDefault<z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>>;
        search: z.ZodOptional<z.ZodString>;
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
        language: z.ZodOptional<z.ZodString>;
        sortBy: z.ZodDefault<z.ZodOptional<z.ZodEnum<["createdAt", "name", "status"]>>>;
        sortOrder: z.ZodDefault<z.ZodOptional<z.ZodEnum<["asc", "desc"]>>>;
    }, "strip", z.ZodTypeAny, {
        page: number;
        limit: number;
        sortBy: "name" | "status" | "createdAt";
        sortOrder: "asc" | "desc";
        search?: string | undefined;
        status?: "PENDING" | "APPROVED" | "REJECTED" | undefined;
        language?: string | undefined;
        category?: "MARKETING" | "UTILITY" | "AUTHENTICATION" | undefined;
    }, {
        search?: string | undefined;
        page?: string | undefined;
        limit?: string | undefined;
        status?: "PENDING" | "APPROVED" | "REJECTED" | undefined;
        language?: string | undefined;
        category?: "MARKETING" | "UTILITY" | "AUTHENTICATION" | undefined;
        sortBy?: "name" | "status" | "createdAt" | undefined;
        sortOrder?: "asc" | "desc" | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        page: number;
        limit: number;
        sortBy: "name" | "status" | "createdAt";
        sortOrder: "asc" | "desc";
        search?: string | undefined;
        status?: "PENDING" | "APPROVED" | "REJECTED" | undefined;
        language?: string | undefined;
        category?: "MARKETING" | "UTILITY" | "AUTHENTICATION" | undefined;
    };
}, {
    query: {
        search?: string | undefined;
        page?: string | undefined;
        limit?: string | undefined;
        status?: "PENDING" | "APPROVED" | "REJECTED" | undefined;
        language?: string | undefined;
        category?: "MARKETING" | "UTILITY" | "AUTHENTICATION" | undefined;
        sortBy?: "name" | "status" | "createdAt" | undefined;
        sortOrder?: "asc" | "desc" | undefined;
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
export declare const submitTemplateSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    body: z.ZodObject<{
        whatsappAccountId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        whatsappAccountId: string;
    }, {
        whatsappAccountId: string;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        id: string;
    };
    body: {
        whatsappAccountId: string;
    };
}, {
    params: {
        id: string;
    };
    body: {
        whatsappAccountId: string;
    };
}>;
export declare const previewTemplateSchema: z.ZodObject<{
    body: z.ZodObject<{
        headerType: z.ZodOptional<z.ZodEnum<["NONE", "TEXT", "IMAGE", "VIDEO", "DOCUMENT"]>>;
        headerContent: z.ZodOptional<z.ZodString>;
        bodyText: z.ZodString;
        footerText: z.ZodOptional<z.ZodString>;
        buttons: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
            type: z.ZodLiteral<"QUICK_REPLY">;
            text: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            type: "QUICK_REPLY";
            text: string;
        }, {
            type: "QUICK_REPLY";
            text: string;
        }>, z.ZodObject<{
            type: z.ZodLiteral<"URL">;
            text: z.ZodString;
            url: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            type: "URL";
            url: string;
            text: string;
        }, {
            type: "URL";
            url: string;
            text: string;
        }>, z.ZodObject<{
            type: z.ZodLiteral<"PHONE_NUMBER">;
            text: z.ZodString;
            phoneNumber: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            phoneNumber: string;
            type: "PHONE_NUMBER";
            text: string;
        }, {
            phoneNumber: string;
            type: "PHONE_NUMBER";
            text: string;
        }>]>, "many">>;
        variables: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        bodyText: string;
        headerType?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "NONE" | undefined;
        headerContent?: string | undefined;
        footerText?: string | undefined;
        buttons?: ({
            type: "QUICK_REPLY";
            text: string;
        } | {
            type: "URL";
            url: string;
            text: string;
        } | {
            phoneNumber: string;
            type: "PHONE_NUMBER";
            text: string;
        })[] | undefined;
        variables?: Record<string, string> | undefined;
    }, {
        bodyText: string;
        headerType?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "NONE" | undefined;
        headerContent?: string | undefined;
        footerText?: string | undefined;
        buttons?: ({
            type: "QUICK_REPLY";
            text: string;
        } | {
            type: "URL";
            url: string;
            text: string;
        } | {
            phoneNumber: string;
            type: "PHONE_NUMBER";
            text: string;
        })[] | undefined;
        variables?: Record<string, string> | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        bodyText: string;
        headerType?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "NONE" | undefined;
        headerContent?: string | undefined;
        footerText?: string | undefined;
        buttons?: ({
            type: "QUICK_REPLY";
            text: string;
        } | {
            type: "URL";
            url: string;
            text: string;
        } | {
            phoneNumber: string;
            type: "PHONE_NUMBER";
            text: string;
        })[] | undefined;
        variables?: Record<string, string> | undefined;
    };
}, {
    body: {
        bodyText: string;
        headerType?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "NONE" | undefined;
        headerContent?: string | undefined;
        footerText?: string | undefined;
        buttons?: ({
            type: "QUICK_REPLY";
            text: string;
        } | {
            type: "URL";
            url: string;
            text: string;
        } | {
            phoneNumber: string;
            type: "PHONE_NUMBER";
            text: string;
        })[] | undefined;
        variables?: Record<string, string> | undefined;
    };
}>;
export type CreateTemplateSchema = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateSchema = z.infer<typeof updateTemplateSchema>;
export type GetTemplatesSchema = z.infer<typeof getTemplatesSchema>;
export type DuplicateTemplateSchema = z.infer<typeof duplicateTemplateSchema>;
export type SubmitTemplateSchema = z.infer<typeof submitTemplateSchema>;
export type PreviewTemplateSchema = z.infer<typeof previewTemplateSchema>;
//# sourceMappingURL=templates.schema.d.ts.map