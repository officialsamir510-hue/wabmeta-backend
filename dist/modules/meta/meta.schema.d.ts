import { z } from 'zod';
export declare const tokenExchangeSchema: z.ZodObject<{
    body: z.ZodObject<{
        code: z.ZodString;
        organizationId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        code: string;
        organizationId: string;
    }, {
        code: string;
        organizationId: string;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        code: string;
        organizationId: string;
    };
}, {
    body: {
        code: string;
        organizationId: string;
    };
}>;
export declare const getOAuthUrlSchema: z.ZodObject<{
    query: z.ZodObject<{
        organizationId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        organizationId?: string | undefined;
    }, {
        organizationId?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        organizationId?: string | undefined;
    };
}, {
    query: {
        organizationId?: string | undefined;
    };
}>;
export type TokenExchangeBody = z.infer<typeof tokenExchangeSchema>['body'];
export type GetOAuthUrlQuery = z.infer<typeof getOAuthUrlSchema>['query'];
//# sourceMappingURL=meta.schema.d.ts.map