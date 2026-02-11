"use strict";
// src/modules/meta/meta.schema.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookVerifySchema = exports.refreshTokenSchema = exports.disconnectAccountSchema = exports.tokenExchangeSchema = void 0;
const zod_1 = require("zod");
exports.tokenExchangeSchema = zod_1.z.object({
    body: zod_1.z.object({
        code: zod_1.z.string().min(1, 'Authorization code is required'),
        organizationId: zod_1.z.string().min(1, 'Organization ID is required'),
    }),
});
exports.disconnectAccountSchema = zod_1.z.object({
    params: zod_1.z.object({
        accountId: zod_1.z.string().min(1, 'Account ID is required'),
    }),
});
exports.refreshTokenSchema = zod_1.z.object({
    params: zod_1.z.object({
        accountId: zod_1.z.string().min(1, 'Account ID is required'),
    }),
});
exports.webhookVerifySchema = zod_1.z.object({
    query: zod_1.z.object({
        'hub.mode': zod_1.z.string(),
        'hub.verify_token': zod_1.z.string(),
        'hub.challenge': zod_1.z.string(),
    }),
});
//# sourceMappingURL=meta.schema.js.map