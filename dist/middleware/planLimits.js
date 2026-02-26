"use strict";
// src/middleware/planLimits.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAutomationLimit = exports.checkChatbotLimit = exports.checkTemplateLimit = exports.checkTeamMemberLimit = exports.checkMessageLimit = exports.checkCampaignLimit = exports.checkContactLimit = exports.checkPlanLimit = void 0;
const billing_service_1 = require("../modules/billing/billing.service");
const response_1 = require("../utils/response");
const checkPlanLimit = (limitType) => {
    return async (req, res, next) => {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                return (0, response_1.errorResponse)(res, 'Organization not found', 400);
            }
            // Check subscription validity first
            const validity = await billing_service_1.billingService.checkSubscriptionValidity(organizationId);
            if (!validity.isValid) {
                return res.status(402).json({
                    success: false,
                    message: validity.message || 'Subscription expired',
                    code: 'SUBSCRIPTION_EXPIRED',
                    data: {
                        isExpired: validity.isExpired,
                        upgradeRequired: true,
                    }
                });
            }
            // Check specific limit
            const limitCheck = await billing_service_1.billingService.checkPlanLimit(organizationId, limitType);
            if (!limitCheck.allowed) {
                return res.status(402).json({
                    success: false,
                    message: limitCheck.message,
                    code: 'LIMIT_EXCEEDED',
                    data: {
                        limitType,
                        used: limitCheck.used,
                        limit: limitCheck.limit,
                        remaining: limitCheck.remaining,
                        upgradeRequired: true,
                    }
                });
            }
            // Add limit info to request for later use
            req.planLimit = {
                type: limitType,
                used: limitCheck.used,
                limit: limitCheck.limit,
                remaining: limitCheck.remaining,
            };
            next();
        }
        catch (error) {
            console.error('Plan limit check error:', error);
            // Allow on error to not block users
            next();
        }
    };
};
exports.checkPlanLimit = checkPlanLimit;
// Convenience middlewares
exports.checkContactLimit = (0, exports.checkPlanLimit)('contacts');
exports.checkCampaignLimit = (0, exports.checkPlanLimit)('campaigns');
exports.checkMessageLimit = (0, exports.checkPlanLimit)('messages');
exports.checkTeamMemberLimit = (0, exports.checkPlanLimit)('teamMembers');
exports.checkTemplateLimit = (0, exports.checkPlanLimit)('templates');
exports.checkChatbotLimit = (0, exports.checkPlanLimit)('chatbots');
exports.checkAutomationLimit = (0, exports.checkPlanLimit)('automations');
//# sourceMappingURL=planLimits.js.map