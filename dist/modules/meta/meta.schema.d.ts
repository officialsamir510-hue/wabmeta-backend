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
export declare const disconnectAccountSchema: z.ZodObject<{
    params: z.ZodObject<{
        accountId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        accountId: string;
    }, {
        accountId: string;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        accountId: string;
    };
}, {
    params: {
        accountId: string;
    };
}>;
export declare const refreshTokenSchema: z.ZodObject<{
    params: z.ZodObject<{
        accountId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        accountId: string;
    }, {
        accountId: string;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        accountId: string;
    };
}, {
    params: {
        accountId: string;
    };
}>;
export declare const webhookVerifySchema: z.ZodObject<{
    query: z.ZodObject<{
        'hub.mode': z.ZodString;
        'hub.verify_token': z.ZodString;
        'hub.challenge': z.ZodString;
    }, "strip", z.ZodTypeAny, {
        'hub.mode': string;
        'hub.verify_token': string;
        'hub.challenge': string;
    }, {
        'hub.mode': string;
        'hub.verify_token': string;
        'hub.challenge': string;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        'hub.mode': string;
        'hub.verify_token': string;
        'hub.challenge': string;
    };
}, {
    query: {
        'hub.mode': string;
        'hub.verify_token': string;
        'hub.challenge': string;
    };
}>;
export type TokenExchangeInput = z.infer<typeof tokenExchangeSchema>;
export type DisconnectAccountInput = z.infer<typeof disconnectAccountSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type WebhookVerifyInput = z.infer<typeof webhookVerifySchema>;
//# sourceMappingURL=meta.schema.d.ts.map