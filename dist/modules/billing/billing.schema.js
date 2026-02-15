"use strict";
// src/modules/billing/billing.schema.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.billingSchema = void 0;
const zod_1 = require("zod");
exports.billingSchema = {
    createOrder: zod_1.z.object({
        body: zod_1.z.object({
            planKey: zod_1.z.string().min(1, 'Plan key is required'),
            billingCycle: zod_1.z.enum(['monthly', 'yearly']).optional().default('monthly')
        })
    }),
    verifyPayment: zod_1.z.object({
        body: zod_1.z.object({
            razorpay_order_id: zod_1.z.string().min(1, 'Order ID is required'),
            razorpay_payment_id: zod_1.z.string().min(1, 'Payment ID is required'),
            razorpay_signature: zod_1.z.string().min(1, 'Signature is required')
        })
    }),
    upgrade: zod_1.z.object({
        body: zod_1.z.object({
            planType: zod_1.z.string().min(1, 'Plan type is required'),
            billingCycle: zod_1.z.enum(['monthly', 'yearly']).optional().default('monthly')
        })
    })
};
//# sourceMappingURL=billing.schema.js.map