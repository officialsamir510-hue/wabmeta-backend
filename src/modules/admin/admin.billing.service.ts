// src/modules/admin/admin.billing.service.ts

import { PrismaClient, PlanType, SubscriptionStatus } from '@prisma/client';
import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';

export class AdminBillingService {
    // ============================================
    // ASSIGN PLAN TO USER (MANUAL)
    // ============================================

    async assignPlanToOrganization(params: {
        organizationId: string;
        planSlug: string;
        validityDays?: number;
        customEndDate?: Date;
        adminId: string;
        adminName: string;
        reason?: string;
    }) {
        const { organizationId, planSlug, validityDays, customEndDate, adminId, adminName, reason } = params;

        console.log('🔧 Admin assigning plan:', {
            organizationId,
            planSlug,
            validityDays,
            customEndDate,
            adminId,
        });

        // Verify organization exists
        const organization = await prisma.organization.findUnique({
            where: { id: organizationId },
            include: { owner: true },
        });

        if (!organization) {
            throw new AppError('Organization not found', 404);
        }

        // Find plan
        const plan = await prisma.plan.findFirst({
            where: {
                OR: [
                    { slug: planSlug.toLowerCase() },
                    { type: planSlug.toUpperCase() as PlanType },
                ],
                isActive: true,
            },
        });

        if (!plan) {
            throw new AppError(`Plan '${planSlug}' not found`, 404);
        }

        // Calculate dates
        const now = new Date();
        let periodEnd: Date;

        if (customEndDate) {
            // Admin specified custom end date
            periodEnd = new Date(customEndDate);
        } else if (validityDays) {
            // Admin specified custom validity days
            periodEnd = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);
        } else {
            // Use plan's default validity
            const defaultValidity = plan.validityDays || 30;
            periodEnd = new Date(now.getTime() + defaultValidity * 24 * 60 * 60 * 1000);
        }

        // Check if subscription exists
        const existingSubscription = await prisma.subscription.findUnique({
            where: { organizationId },
            include: { plan: true },
        });

        // Create/Update subscription
        const subscription = await prisma.subscription.upsert({
            where: { organizationId },
            create: {
                organizationId,
                planId: plan.id,
                status: SubscriptionStatus.ACTIVE,
                billingCycle: 'manual', // Mark as manually assigned
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                paymentMethod: 'admin_assigned',
                lastPaymentAt: now,
                messagesUsed: 0,
                contactsUsed: 0,
            },
            update: {
                planId: plan.id,
                status: SubscriptionStatus.ACTIVE,
                billingCycle: 'manual',
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                paymentMethod: 'admin_assigned',
                lastPaymentAt: now,
                cancelledAt: null,
            },
            include: { plan: true },
        });

        // Update organization plan type
        await prisma.organization.update({
            where: { id: organizationId },
            data: { planType: plan.type },
        });

        // Create activity log
        await prisma.activityLog.create({
            data: {
                organizationId,
                action: 'UPDATE',
                entity: 'subscription',
                entityId: subscription.id,
                metadata: {
                    action: 'admin_plan_assignment',
                    adminId,
                    adminName,
                    previousPlan: existingSubscription?.plan?.name || 'None',
                    newPlan: plan.name,
                    planType: plan.type,
                    validityDays: validityDays || plan.validityDays,
                    periodEnd: periodEnd.toISOString(),
                    reason: reason || 'Manual assignment by admin',
                    assignedBy: adminName,
                    assignedAt: now.toISOString(),
                },
            },
        });

        console.log('✅ Plan assigned successfully:', {
            organization: organization.name,
            plan: plan.name,
            validUntil: periodEnd,
        });

        return {
            subscription,
            plan,
            organization: {
                id: organization.id,
                name: organization.name,
                ownerEmail: organization.owner.email,
            },
            validFrom: now,
            validUntil: periodEnd,
            message: `${plan.name} assigned to ${organization.name} until ${periodEnd.toLocaleDateString('en-IN')}`,
        };
    }

    // ============================================
    // EXTEND SUBSCRIPTION
    // ============================================

    async extendSubscription(params: {
        organizationId: string;
        additionalDays: number;
        adminId: string;
        adminName: string;
        reason?: string;
    }) {
        const { organizationId, additionalDays, adminId, adminName, reason } = params;

        console.log('🔧 Admin extending subscription:', {
            organizationId,
            additionalDays,
            adminId,
        });

        const subscription = await prisma.subscription.findUnique({
            where: { organizationId },
            include: { plan: true },
        });

        if (!subscription) {
            throw new AppError('No active subscription found', 404);
        }

        // Extend from current end date or now (whichever is later)
        const now = new Date();
        const currentEnd = new Date(subscription.currentPeriodEnd);
        const extendFrom = currentEnd > now ? currentEnd : now;

        const newEndDate = new Date(extendFrom.getTime() + additionalDays * 24 * 60 * 60 * 1000);

        // Update subscription
        const updated = await prisma.subscription.update({
            where: { organizationId },
            data: {
                currentPeriodEnd: newEndDate,
                status: SubscriptionStatus.ACTIVE,
                cancelledAt: null,
            },
            include: { plan: true, organization: true },
        });

        // Log activity
        await prisma.activityLog.create({
            data: {
                organizationId,
                action: 'UPDATE',
                entity: 'subscription',
                entityId: subscription.id,
                metadata: {
                    action: 'admin_subscription_extension',
                    adminId,
                    adminName,
                    additionalDays,
                    previousEndDate: currentEnd.toISOString(),
                    newEndDate: newEndDate.toISOString(),
                    reason: reason || 'Subscription extended by admin',
                    extendedBy: adminName,
                    extendedAt: now.toISOString(),
                },
            },
        });

        console.log('✅ Subscription extended:', {
            organization: updated.organization.name,
            newEndDate,
        });

        return {
            subscription: updated,
            previousEndDate: currentEnd,
            newEndDate,
            daysAdded: additionalDays,
            message: `Subscription extended by ${additionalDays} days until ${newEndDate.toLocaleDateString('en-IN')}`,
        };
    }

    // ============================================
    // CANCEL/REVOKE SUBSCRIPTION
    // ============================================

    async revokeSubscription(params: {
        organizationId: string;
        adminId: string;
        adminName: string;
        reason?: string;
        immediate?: boolean;
    }) {
        const { organizationId, adminId, adminName, reason, immediate = false } = params;

        console.log('🔧 Admin revoking subscription:', {
            organizationId,
            immediate,
            adminId,
        });

        const subscription = await prisma.subscription.findUnique({
            where: { organizationId },
            include: { plan: true, organization: true },
        });

        if (!subscription) {
            throw new AppError('No subscription found', 404);
        }

        const now = new Date();
        const updateData: any = {
            status: SubscriptionStatus.CANCELLED,
            cancelledAt: now,
        };

        // If immediate revoke, set end date to now
        if (immediate) {
            updateData.currentPeriodEnd = now;
        }

        const updated = await prisma.subscription.update({
            where: { organizationId },
            data: updateData,
            include: { plan: true, organization: true },
        });

        // Downgrade to free plan
        await prisma.organization.update({
            where: { id: organizationId },
            data: { planType: PlanType.FREE_DEMO },
        });

        // Log activity
        await prisma.activityLog.create({
            data: {
                organizationId,
                action: 'UPDATE',
                entity: 'subscription',
                entityId: subscription.id,
                metadata: {
                    action: 'admin_subscription_revocation',
                    adminId,
                    adminName,
                    previousPlan: subscription.plan.name,
                    immediate,
                    reason: reason || 'Subscription revoked by admin',
                    revokedBy: adminName,
                    revokedAt: now.toISOString(),
                },
            },
        });

        console.log('✅ Subscription revoked:', {
            organization: updated.organization.name,
            immediate,
        });

        return {
            subscription: updated,
            message: immediate
                ? 'Subscription revoked immediately'
                : 'Subscription will expire at the end of current period',
        };
    }

    // ============================================
    // GET ALL SUBSCRIPTIONS (ADMIN VIEW)
    // ============================================

    async getAllSubscriptions(params: {
        page?: number;
        limit?: number;
        status?: SubscriptionStatus;
        planType?: PlanType;
        search?: string;
    }) {
        const { page = 1, limit = 20, status, planType, search } = params;
        const skip = (page - 1) * limit;

        const where: any = {};

        if (status) {
            where.status = status;
        }

        if (planType) {
            where.plan = { type: planType };
        }

        if (search) {
            where.organization = {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { owner: { email: { contains: search, mode: 'insensitive' } } },
                ],
            };
        }

        const [subscriptions, total] = await Promise.all([
            prisma.subscription.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    plan: true,
                    organization: {
                        include: {
                            owner: {
                                select: {
                                    email: true,
                                    firstName: true,
                                    lastName: true,
                                },
                            },
                        },
                    },
                },
            }),
            prisma.subscription.count({ where }),
        ]);

        // Calculate stats for each subscription
        const subscriptionsWithStats = subscriptions.map((sub) => {
            const now = new Date();
            const daysRemaining = Math.max(
                0,
                Math.ceil((sub.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            );
            const isExpired = sub.currentPeriodEnd < now;

            return {
                ...sub,
                daysRemaining,
                isExpired,
                isManual: sub.paymentMethod === 'admin_assigned',
            };
        });

        return {
            subscriptions: subscriptionsWithStats,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    // ============================================
    // GET SUBSCRIPTION STATS
    // ============================================

    async getSubscriptionStats() {
        const [
            totalSubscriptions,
            activeSubscriptions,
            expiredSubscriptions,
            planBreakdown,
            recentAssignments,
        ] = await Promise.all([
            prisma.subscription.count(),
            prisma.subscription.count({
                where: { status: SubscriptionStatus.ACTIVE },
            }),
            prisma.subscription.count({
                where: { status: SubscriptionStatus.EXPIRED },
            }),
            prisma.subscription.groupBy({
                by: ['planId'],
                _count: true,
            }),
            prisma.activityLog.findMany({
                where: {
                    entity: 'subscription',
                    action: 'UPDATE',
                },
                orderBy: { createdAt: 'desc' },
                take: 10,
                include: {
                    organization: {
                        select: { name: true },
                    },
                },
            }),
        ]);

        // Get plans for breakdown
        const plans = await prisma.plan.findMany({
            where: {
                id: { in: planBreakdown.map((pb) => pb.planId) },
            },
        });

        const planStats = planBreakdown.map((pb) => {
            const plan = plans.find((p) => p.id === pb.planId);
            return {
                planName: plan?.name || 'Unknown',
                planType: plan?.type || 'UNKNOWN',
                count: pb._count,
            };
        });

        return {
            total: totalSubscriptions,
            active: activeSubscriptions,
            expired: expiredSubscriptions,
            cancelled: await prisma.subscription.count({
                where: { status: SubscriptionStatus.CANCELLED },
            }),
            planBreakdown: planStats,
            recentActivity: recentAssignments,
        };
    }
}

export const adminBillingService = new AdminBillingService();
export default adminBillingService;