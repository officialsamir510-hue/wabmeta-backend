import { z } from 'zod';
export declare const upgradePlanSchema: z.ZodObject<{
    body: z.ZodObject<{
        planType: z.ZodNativeEnum<{
            FREE: "FREE";
            STARTER: "STARTER";
            PRO: "PRO";
            ENTERPRISE: "ENTERPRISE";
        }>;
        billingCycle: z.ZodDefault<z.ZodEnum<["monthly", "yearly"]>>;
        paymentMethodId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        planType: "FREE" | "STARTER" | "PRO" | "ENTERPRISE";
        billingCycle: "monthly" | "yearly";
        paymentMethodId?: string | undefined;
    }, {
        planType: "FREE" | "STARTER" | "PRO" | "ENTERPRISE";
        billingCycle?: "monthly" | "yearly" | undefined;
        paymentMethodId?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        planType: "FREE" | "STARTER" | "PRO" | "ENTERPRISE";
        billingCycle: "monthly" | "yearly";
        paymentMethodId?: string | undefined;
    };
}, {
    body: {
        planType: "FREE" | "STARTER" | "PRO" | "ENTERPRISE";
        billingCycle?: "monthly" | "yearly" | undefined;
        paymentMethodId?: string | undefined;
    };
}>;
export declare const addPaymentMethodSchema: z.ZodObject<{
    body: z.ZodObject<{
        type: z.ZodEnum<["card", "upi", "bank"]>;
        details: z.ZodObject<{
            cardNumber: z.ZodOptional<z.ZodString>;
            expiryMonth: z.ZodOptional<z.ZodString>;
            expiryYear: z.ZodOptional<z.ZodString>;
            cvv: z.ZodOptional<z.ZodString>;
            upiId: z.ZodOptional<z.ZodString>;
            accountNumber: z.ZodOptional<z.ZodString>;
            ifsc: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            expiryMonth?: string | undefined;
            expiryYear?: string | undefined;
            upiId?: string | undefined;
            cardNumber?: string | undefined;
            cvv?: string | undefined;
            accountNumber?: string | undefined;
            ifsc?: string | undefined;
        }, {
            expiryMonth?: string | undefined;
            expiryYear?: string | undefined;
            upiId?: string | undefined;
            cardNumber?: string | undefined;
            cvv?: string | undefined;
            accountNumber?: string | undefined;
            ifsc?: string | undefined;
        }>;
        isDefault: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, "strip", z.ZodTypeAny, {
        type: "card" | "upi" | "bank";
        isDefault: boolean;
        details: {
            expiryMonth?: string | undefined;
            expiryYear?: string | undefined;
            upiId?: string | undefined;
            cardNumber?: string | undefined;
            cvv?: string | undefined;
            accountNumber?: string | undefined;
            ifsc?: string | undefined;
        };
    }, {
        type: "card" | "upi" | "bank";
        details: {
            expiryMonth?: string | undefined;
            expiryYear?: string | undefined;
            upiId?: string | undefined;
            cardNumber?: string | undefined;
            cvv?: string | undefined;
            accountNumber?: string | undefined;
            ifsc?: string | undefined;
        };
        isDefault?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    body: {
        type: "card" | "upi" | "bank";
        isDefault: boolean;
        details: {
            expiryMonth?: string | undefined;
            expiryYear?: string | undefined;
            upiId?: string | undefined;
            cardNumber?: string | undefined;
            cvv?: string | undefined;
            accountNumber?: string | undefined;
            ifsc?: string | undefined;
        };
    };
}, {
    body: {
        type: "card" | "upi" | "bank";
        details: {
            expiryMonth?: string | undefined;
            expiryYear?: string | undefined;
            upiId?: string | undefined;
            cardNumber?: string | undefined;
            cvv?: string | undefined;
            accountNumber?: string | undefined;
            ifsc?: string | undefined;
        };
        isDefault?: boolean | undefined;
    };
}>;
export declare const deletePaymentMethodSchema: z.ZodObject<{
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
export declare const setDefaultPaymentMethodSchema: z.ZodObject<{
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
export declare const getInvoicesSchema: z.ZodObject<{
    query: z.ZodObject<{
        page: z.ZodDefault<z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>>;
        limit: z.ZodDefault<z.ZodOptional<z.ZodEffects<z.ZodString, number, string>>>;
    }, "strip", z.ZodTypeAny, {
        page: number;
        limit: number;
    }, {
        page?: string | undefined;
        limit?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    query: {
        page: number;
        limit: number;
    };
}, {
    query: {
        page?: string | undefined;
        limit?: string | undefined;
    };
}>;
export type UpgradePlanSchema = z.infer<typeof upgradePlanSchema>;
export type AddPaymentMethodSchema = z.infer<typeof addPaymentMethodSchema>;
//# sourceMappingURL=billing.schema.d.ts.map