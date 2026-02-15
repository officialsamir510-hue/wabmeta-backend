import { z } from 'zod';
export declare const billingSchema: {
    createOrder: z.ZodObject<{
        body: z.ZodObject<{
            planKey: z.ZodString;
            billingCycle: z.ZodDefault<z.ZodOptional<z.ZodEnum<["monthly", "yearly"]>>>;
        }, "strip", z.ZodTypeAny, {
            billingCycle: "monthly" | "yearly";
            planKey: string;
        }, {
            planKey: string;
            billingCycle?: "monthly" | "yearly" | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        body: {
            billingCycle: "monthly" | "yearly";
            planKey: string;
        };
    }, {
        body: {
            planKey: string;
            billingCycle?: "monthly" | "yearly" | undefined;
        };
    }>;
    verifyPayment: z.ZodObject<{
        body: z.ZodObject<{
            razorpay_order_id: z.ZodString;
            razorpay_payment_id: z.ZodString;
            razorpay_signature: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
        }, {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
        }>;
    }, "strip", z.ZodTypeAny, {
        body: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
        };
    }, {
        body: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
        };
    }>;
    upgrade: z.ZodObject<{
        body: z.ZodObject<{
            planType: z.ZodString;
            billingCycle: z.ZodDefault<z.ZodOptional<z.ZodEnum<["monthly", "yearly"]>>>;
        }, "strip", z.ZodTypeAny, {
            planType: string;
            billingCycle: "monthly" | "yearly";
        }, {
            planType: string;
            billingCycle?: "monthly" | "yearly" | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        body: {
            planType: string;
            billingCycle: "monthly" | "yearly";
        };
    }, {
        body: {
            planType: string;
            billingCycle?: "monthly" | "yearly" | undefined;
        };
    }>;
};
//# sourceMappingURL=billing.schema.d.ts.map