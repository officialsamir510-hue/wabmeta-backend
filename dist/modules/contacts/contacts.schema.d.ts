import { z } from 'zod';
export declare const createContactSchema: z.ZodObject<{
    body: z.ZodObject<{
        phone: z.ZodString;
        countryCode: z.ZodDefault<z.ZodString>;
        firstName: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        lastName: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        email: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        tags: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
        customFields: z.ZodDefault<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>>;
        groupIds: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    }, "strip", z.ZodTypeAny, {
        phone: string;
        countryCode: string;
        customFields: Record<string, any>;
        tags: string[];
        groupIds: string[];
        email?: string | null | undefined;
        firstName?: string | null | undefined;
        lastName?: string | null | undefined;
    }, {
        phone: string;
        email?: string | null | undefined;
        firstName?: string | null | undefined;
        lastName?: string | null | undefined;
        countryCode?: string | undefined;
        customFields?: Record<string, any> | undefined;
        tags?: string[] | undefined;
        groupIds?: string[] | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        phone: string;
        countryCode: string;
        customFields: Record<string, any>;
        tags: string[];
        groupIds: string[];
        email?: string | null | undefined;
        firstName?: string | null | undefined;
        lastName?: string | null | undefined;
    };
}, {
    body: {
        phone: string;
        email?: string | null | undefined;
        firstName?: string | null | undefined;
        lastName?: string | null | undefined;
        countryCode?: string | undefined;
        customFields?: Record<string, any> | undefined;
        tags?: string[] | undefined;
        groupIds?: string[] | undefined;
    };
}>;
export declare const updateContactSchema: z.ZodObject<{
    params: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    body: z.ZodObject<{
        phone: z.ZodOptional<z.ZodString>;
        countryCode: z.ZodOptional<z.ZodDefault<z.ZodString>>;
        firstName: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        lastName: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        email: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        tags: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
        customFields: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        status: z.ZodOptional<z.ZodNativeEnum<{
            ACTIVE: "ACTIVE";
            BLOCKED: "BLOCKED";
            UNSUBSCRIBED: "UNSUBSCRIBED";
        }>>;
    }, "strip", z.ZodTypeAny, {
        tags: string[];
        email?: string | null | undefined;
        firstName?: string | null | undefined;
        lastName?: string | null | undefined;
        phone?: string | undefined;
        status?: "ACTIVE" | "BLOCKED" | "UNSUBSCRIBED" | undefined;
        countryCode?: string | undefined;
        customFields?: Record<string, any> | undefined;
    }, {
        email?: string | null | undefined;
        firstName?: string | null | undefined;
        lastName?: string | null | undefined;
        phone?: string | undefined;
        status?: "ACTIVE" | "BLOCKED" | "UNSUBSCRIBED" | undefined;
        countryCode?: string | undefined;
        customFields?: Record<string, any> | undefined;
        tags?: string[] | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        id: string;
    };
    body: {
        tags: string[];
        email?: string | null | undefined;
        firstName?: string | null | undefined;
        lastName?: string | null | undefined;
        phone?: string | undefined;
        status?: "ACTIVE" | "BLOCKED" | "UNSUBSCRIBED" | undefined;
        countryCode?: string | undefined;
        customFields?: Record<string, any> | undefined;
    };
}, {
    params: {
        id: string;
    };
    body: {
        email?: string | null | undefined;
        firstName?: string | null | undefined;
        lastName?: string | null | undefined;
        phone?: string | undefined;
        status?: "ACTIVE" | "BLOCKED" | "UNSUBSCRIBED" | undefined;
        countryCode?: string | undefined;
        customFields?: Record<string, any> | undefined;
        tags?: string[] | undefined;
    };
}>;
export declare const getContactsSchema: z.ZodObject<{
    query: z.ZodObject<{
        page: z.ZodDefault<z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>>;
        limit: z.ZodDefault<z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>>;
        search: z.ZodOptional<z.ZodString>;
        status: z.ZodOptional<z.ZodNativeEnum<{
            ACTIVE: "ACTIVE";
            BLOCKED: "BLOCKED";
            UNSUBSCRIBED: "UNSUBSCRIBED";
        }>>;
        tags: z.ZodOptional<z.ZodString>;
        groupId: z.ZodOptional<z.ZodString>;
        sortBy: z.ZodDefault<z.ZodOptional<z.ZodEnum<["createdAt", "firstName", "lastName", "lastMessageAt"]>>>;
        sortOrder: z.ZodDefault<z.ZodOptional<z.ZodEnum<["asc", "desc"]>>>;
    }, "strip", z.ZodTypeAny, {
        page: number;
        limit: number;
        sortBy: "firstName" | "lastName" | "createdAt" | "lastMessageAt";
        sortOrder: "desc" | "asc";
        search?: string | undefined;
        status?: "ACTIVE" | "BLOCKED" | "UNSUBSCRIBED" | undefined;
        tags?: string | undefined;
        groupId?: string | undefined;
    }, {
        search?: string | undefined;
        status?: "ACTIVE" | "BLOCKED" | "UNSUBSCRIBED" | undefined;
        tags?: string | undefined;
        page?: string | undefined;
        limit?: string | undefined;
        groupId?: string | undefined;
        sortBy?: "firstName" | "lastName" | "createdAt" | "lastMessageAt" | undefined;
        sortOrder?: "desc" | "asc" | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        page: number;
        limit: number;
        sortBy: "firstName" | "lastName" | "createdAt" | "lastMessageAt";
        sortOrder: "desc" | "asc";
        search?: string | undefined;
        status?: "ACTIVE" | "BLOCKED" | "UNSUBSCRIBED" | undefined;
        tags?: string | undefined;
        groupId?: string | undefined;
    };
}, {
    query: {
        search?: string | undefined;
        status?: "ACTIVE" | "BLOCKED" | "UNSUBSCRIBED" | undefined;
        tags?: string | undefined;
        page?: string | undefined;
        limit?: string | undefined;
        groupId?: string | undefined;
        sortBy?: "firstName" | "lastName" | "createdAt" | "lastMessageAt" | undefined;
        sortOrder?: "desc" | "asc" | undefined;
    };
}>;
export declare const getContactByIdSchema: z.ZodObject<{
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
export declare const deleteContactSchema: z.ZodObject<{
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
export declare const importContactsSchema: z.ZodObject<{
    body: z.ZodObject<{
        contacts: z.ZodArray<z.ZodObject<{
            phone: z.ZodString;
            countryCode: z.ZodOptional<z.ZodDefault<z.ZodString>>;
            firstName: z.ZodNullable<z.ZodOptional<z.ZodString>>;
            lastName: z.ZodNullable<z.ZodOptional<z.ZodString>>;
            email: z.ZodNullable<z.ZodOptional<z.ZodString>>;
            tags: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
            customFields: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
        }, "strip", z.ZodTypeAny, {
            phone: string;
            tags: string[];
            email?: string | null | undefined;
            firstName?: string | null | undefined;
            lastName?: string | null | undefined;
            countryCode?: string | undefined;
            customFields?: Record<string, any> | undefined;
        }, {
            phone: string;
            email?: string | null | undefined;
            firstName?: string | null | undefined;
            lastName?: string | null | undefined;
            countryCode?: string | undefined;
            customFields?: Record<string, any> | undefined;
            tags?: string[] | undefined;
        }>, "many">;
        groupId: z.ZodOptional<z.ZodString>;
        tags: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
        skipDuplicates: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, "strip", z.ZodTypeAny, {
        contacts: {
            phone: string;
            tags: string[];
            email?: string | null | undefined;
            firstName?: string | null | undefined;
            lastName?: string | null | undefined;
            countryCode?: string | undefined;
            customFields?: Record<string, any> | undefined;
        }[];
        tags: string[];
        skipDuplicates: boolean;
        groupId?: string | undefined;
    }, {
        contacts: {
            phone: string;
            email?: string | null | undefined;
            firstName?: string | null | undefined;
            lastName?: string | null | undefined;
            countryCode?: string | undefined;
            customFields?: Record<string, any> | undefined;
            tags?: string[] | undefined;
        }[];
        tags?: string[] | undefined;
        skipDuplicates?: boolean | undefined;
        groupId?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        contacts: {
            phone: string;
            tags: string[];
            email?: string | null | undefined;
            firstName?: string | null | undefined;
            lastName?: string | null | undefined;
            countryCode?: string | undefined;
            customFields?: Record<string, any> | undefined;
        }[];
        tags: string[];
        skipDuplicates: boolean;
        groupId?: string | undefined;
    };
}, {
    body: {
        contacts: {
            phone: string;
            email?: string | null | undefined;
            firstName?: string | null | undefined;
            lastName?: string | null | undefined;
            countryCode?: string | undefined;
            customFields?: Record<string, any> | undefined;
            tags?: string[] | undefined;
        }[];
        tags?: string[] | undefined;
        skipDuplicates?: boolean | undefined;
        groupId?: string | undefined;
    };
}>;
export declare const bulkUpdateContactsSchema: z.ZodObject<{
    body: z.ZodObject<{
        contactIds: z.ZodArray<z.ZodString, "many">;
        tags: z.ZodOptional<z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>>;
        groupIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        status: z.ZodOptional<z.ZodNativeEnum<{
            ACTIVE: "ACTIVE";
            BLOCKED: "BLOCKED";
            UNSUBSCRIBED: "UNSUBSCRIBED";
        }>>;
    }, "strip", z.ZodTypeAny, {
        contactIds: string[];
        status?: "ACTIVE" | "BLOCKED" | "UNSUBSCRIBED" | undefined;
        tags?: string[] | undefined;
        groupIds?: string[] | undefined;
    }, {
        contactIds: string[];
        status?: "ACTIVE" | "BLOCKED" | "UNSUBSCRIBED" | undefined;
        tags?: string[] | undefined;
        groupIds?: string[] | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        contactIds: string[];
        status?: "ACTIVE" | "BLOCKED" | "UNSUBSCRIBED" | undefined;
        tags?: string[] | undefined;
        groupIds?: string[] | undefined;
    };
}, {
    body: {
        contactIds: string[];
        status?: "ACTIVE" | "BLOCKED" | "UNSUBSCRIBED" | undefined;
        tags?: string[] | undefined;
        groupIds?: string[] | undefined;
    };
}>;
export declare const bulkDeleteContactsSchema: z.ZodObject<{
    body: z.ZodObject<{
        contactIds: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        contactIds: string[];
    }, {
        contactIds: string[];
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        contactIds: string[];
    };
}, {
    body: {
        contactIds: string[];
    };
}>;
export declare const createContactGroupSchema: z.ZodObject<{
    body: z.ZodObject<{
        name: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        color: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        description?: string | undefined;
        color?: string | undefined;
    }, {
        name: string;
        description?: string | undefined;
        color?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        name: string;
        description?: string | undefined;
        color?: string | undefined;
    };
}, {
    body: {
        name: string;
        description?: string | undefined;
        color?: string | undefined;
    };
}>;
export declare const updateContactGroupSchema: z.ZodObject<{
    params: z.ZodObject<{
        groupId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        groupId: string;
    }, {
        groupId: string;
    }>;
    body: z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        color: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name?: string | undefined;
        description?: string | null | undefined;
        color?: string | undefined;
    }, {
        name?: string | undefined;
        description?: string | null | undefined;
        color?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        groupId: string;
    };
    body: {
        name?: string | undefined;
        description?: string | null | undefined;
        color?: string | undefined;
    };
}, {
    params: {
        groupId: string;
    };
    body: {
        name?: string | undefined;
        description?: string | null | undefined;
        color?: string | undefined;
    };
}>;
export declare const addContactsToGroupSchema: z.ZodObject<{
    params: z.ZodObject<{
        groupId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        groupId: string;
    }, {
        groupId: string;
    }>;
    body: z.ZodObject<{
        contactIds: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        contactIds: string[];
    }, {
        contactIds: string[];
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        groupId: string;
    };
    body: {
        contactIds: string[];
    };
}, {
    params: {
        groupId: string;
    };
    body: {
        contactIds: string[];
    };
}>;
export declare const removeContactsFromGroupSchema: z.ZodObject<{
    params: z.ZodObject<{
        groupId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        groupId: string;
    }, {
        groupId: string;
    }>;
    body: z.ZodObject<{
        contactIds: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        contactIds: string[];
    }, {
        contactIds: string[];
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        groupId: string;
    };
    body: {
        contactIds: string[];
    };
}, {
    params: {
        groupId: string;
    };
    body: {
        contactIds: string[];
    };
}>;
export declare const deleteContactGroupSchema: z.ZodObject<{
    params: z.ZodObject<{
        groupId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        groupId: string;
    }, {
        groupId: string;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        groupId: string;
    };
}, {
    params: {
        groupId: string;
    };
}>;
export type CreateContactSchema = z.infer<typeof createContactSchema>;
export type UpdateContactSchema = z.infer<typeof updateContactSchema>;
export type GetContactsSchema = z.infer<typeof getContactsSchema>;
export type ImportContactsSchema = z.infer<typeof importContactsSchema>;
export type BulkUpdateContactsSchema = z.infer<typeof bulkUpdateContactsSchema>;
export type CreateContactGroupSchema = z.infer<typeof createContactGroupSchema>;
//# sourceMappingURL=contacts.schema.d.ts.map