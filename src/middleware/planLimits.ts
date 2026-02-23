// src/middleware/planLimits.ts

import { Request, Response, NextFunction } from 'express';
import { billingService } from '../modules/billing/billing.service';
import { errorResponse } from '../utils/response';

type LimitType = 'contacts' | 'campaigns' | 'messages' | 'teamMembers' | 'templates' | 'chatbots' | 'automations';

export const checkPlanLimit = (limitType: LimitType) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const organizationId = req.user?.organizationId;

            if (!organizationId) {
                return errorResponse(res, 'Organization not found', 400);
            }

            // Check subscription validity first
            const validity = await billingService.checkSubscriptionValidity(organizationId);

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
            const limitCheck = await billingService.checkPlanLimit(organizationId, limitType);

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
            (req as any).planLimit = {
                type: limitType,
                used: limitCheck.used,
                limit: limitCheck.limit,
                remaining: limitCheck.remaining,
            };

            next();
        } catch (error) {
            console.error('Plan limit check error:', error);
            // Allow on error to not block users
            next();
        }
    };
};

// Convenience middlewares
export const checkContactLimit = checkPlanLimit('contacts');
export const checkCampaignLimit = checkPlanLimit('campaigns');
export const checkMessageLimit = checkPlanLimit('messages');
export const checkTeamMemberLimit = checkPlanLimit('teamMembers');
export const checkTemplateLimit = checkPlanLimit('templates');
export const checkChatbotLimit = checkPlanLimit('chatbots');
export const checkAutomationLimit = checkPlanLimit('automations');