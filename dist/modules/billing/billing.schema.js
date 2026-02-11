"use strict";
// src/modules/billing/billing.schema.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInvoicesSchema = exports.setDefaultPaymentMethodSchema = exports.deletePaymentMethodSchema = exports.addPaymentMethodSchema = exports.upgradePlanSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
// ============================================
// REQUEST SCHEMAS
// ============================================
exports.upgradePlanSchema = zod_1.z.object({
    body: zod_1.z.object({
        planType: zod_1.z.nativeEnum(client_1.PlanType),
        billingCycle: zod_1.z.enum(['monthly', 'yearly']).default('monthly'),
        paymentMethodId: zod_1.z.string().optional(),
    }),
});
exports.addPaymentMethodSchema = zod_1.z.object({
    body: zod_1.z.object({
        type: zod_1.z.enum(['card', 'upi', 'bank']),
        details: zod_1.z.object({
            cardNumber: zod_1.z.string().optional(),
            expiryMonth: zod_1.z.string().optional(),
            expiryYear: zod_1.z.string().optional(),
            cvv: zod_1.z.string().optional(),
            upiId: zod_1.z.string().optional(),
            accountNumber: zod_1.z.string().optional(),
            ifsc: zod_1.z.string().optional(),
        }),
        isDefault: zod_1.z.boolean().optional().default(false),
    }),
});
exports.deletePaymentMethodSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Payment method ID is required'),
    }),
});
exports.setDefaultPaymentMethodSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Payment method ID is required'),
    }),
});
exports.getInvoicesSchema = zod_1.z.object({
    query: zod_1.z.object({
        page: zod_1.z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
        limit: zod_1.z.string().regex(/^\d+$/).transform(Number).optional().default('10'),
    }),
});
//# sourceMappingURL=billing.schema.js.map