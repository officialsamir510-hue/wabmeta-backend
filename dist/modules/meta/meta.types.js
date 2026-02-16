"use strict";
// 📁 src/modules/meta/meta.types.ts - COMPLETE META TYPES
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMetaError = isMetaError;
exports.isWebhookMessage = isWebhookMessage;
exports.isWebhookStatus = isWebhookStatus;
// ============================================
// TYPE GUARDS
// ============================================
function isMetaError(response) {
    return response && response.success === false && response.error !== undefined;
}
function isWebhookMessage(entry) {
    return entry.changes.some((change) => change.value.messages !== undefined);
}
function isWebhookStatus(entry) {
    return entry.changes.some((change) => change.value.statuses !== undefined);
}
//# sourceMappingURL=meta.types.js.map