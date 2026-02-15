"use strict";
// src/modules/meta/meta.schema.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOAuthUrlSchema = exports.tokenExchangeSchema = void 0;
const zod_1 = require("zod");
exports.tokenExchangeSchema = zod_1.z.object({
    body: zod_1.z.object({
        code: zod_1.z.string().min(1, 'Code is required'),
        organizationId: zod_1.z.string().min(1, 'Organization ID is required'),
    }),
});
exports.getOAuthUrlSchema = zod_1.z.object({
    query: zod_1.z.object({
        organizationId: zod_1.z.string().optional(),
    }),
});
//# sourceMappingURL=meta.schema.js.map