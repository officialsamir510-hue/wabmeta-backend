// src/modules/admin/admin.billing.service.ts - FIXED VERSION

import { PrismaClient, PlanType, SubscriptionStatus } from '@prisma/client';
import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';

// ============================================
// ✅ SLUG TO PLAN TYPE MAPPING (IMPORTANT!)
// ============================================

const SLUG_TO_PLAN_TYPE: Record<string, PlanType> = {
    'free-demo': PlanType.FREE_DEMO,
    'free': PlanType.FREE_DEMO,
    'freedemo': PlanType.FREE_DEMO,

    'monthly': PlanType.MONTHLY,
    'month': PlanType.MONTHLY,
    '1-month': PlanType.MONTHLY,

    '3-month': PlanType.QUARTERLY,
    '3month': PlanType.QUARTERLY,
    'quarterly': PlanType.QUARTERLY,
    'quarter': PlanType.QUARTERLY,

    '6-month': PlanType.BIANNUAL,
    '6month': PlanType.BIANNUAL,
    'biannual': PlanType.BIANNUAL,
    'half-yearly': PlanType.BIANNUAL,
    'halfyearly': PlanType.BIANNUAL,

    '1-year': PlanType.ANNUAL,
    '1year': PlanType.ANNUAL,
    'annual': PlanType.ANNUAL,
    'yearly': PlanType.ANNUAL,
    '12-month': PlanType.ANNUAL,
    '12month': PlanType.ANNUAL,
};

export class AdminBillingService {
    // ============================================
    // ✅ HELPER: Get Plan by Slug (FIXED)
    // ============================================

    private async getPlanBySlugOrType(slugOrType: string) {
        const normalizedSlug = slugOrType.toLowerCase().trim().replace(/\s+/g, '-');

        console.log('🔍 Looking for plan:', { input: slugOrType, normalized: normalizedSlug });

        // First: Try exact slug match
        let plan = await prisma.plan.findFirst({
            where: {
                slug: normalizedSlug,
                isActive: true,
            },
        });

        if (plan) {
            console.log('✅ Found by slug:', plan.name);
            return plan;
        }

        // Second: Try mapped PlanType
        const mappedType = SLUG_TO_PLAN_TYPE[normalizedSlug];
        if (mappedType) {
            console.log('🔄 Mapped to PlanType:', mappedType);

            plan = await prisma.plan.findFirst({
                where: {
                    type: mappedType,
                    isActive: true,
                },
            });

            if (plan) {
                console.log('✅ Found by type:', plan.name);
                return plan;
            }
        }

        // Third: Try if it's already a valid PlanType enum
        const upperType = normalizedSlug.toUpperCase().replace(/-/g, '_');
        const validPlanTypes = Object.values(PlanType);

        if (validPlanTypes.includes(upperType as PlanType)) {
            plan = await prisma.plan.findFirst({
                where: {
                    type: upperType as PlanType,
                    isActive: true,
                },
            });

            if (plan) {
                console.log('✅ Found by direct enum:', plan.name);
                return plan;
            }
        }

        console.log('❌ Plan not found for:', slugOrType);
        return null;
    }

    // ============================================
    // ✅ ASSIGN PLAN TO ORGANIZATION (FIXED)
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

        console.log('\n🔧 ========== ADMIN PLAN ASSIGNMENT ==========');
        console.log('   Organization ID:', organizationId);
        console.log('   Plan Slug:', planSlug);
        console.log('   Validity Days:', validityDays);
        console.log('   Custom End Date:', customEndDate);
        console.log('   Admin:', adminName);

        // Verify organization exists
        const organization = await prisma.organization.findUnique({
            where: { id: organizationId },
            include: { owner: true },
        });

        if (!organization) {
            throw new AppError('Organization not found', 404);
        }

        console.log('✅ Organization found:', organization.name);

        // ✅ USE FIXED METHOD - Find plan
        const plan = await this.getPlanBySlugOrType(planSlug);

        if (!plan) {
            // List available plans for debugging
            const availablePlans = await prisma.plan.findMany({
                where: { isActive: true },
                select: { slug: true, type: true, name: true },
            });

            console.log('📋 Available plans:', availablePlans);

            throw new AppError(
                `Plan '${planSlug}' not found. Available: ${availablePlans.map(p => p.slug).join(', ')}`,
                404
            );
        }

        console.log('✅ Plan found:', plan.name, '(', plan.type, ')');

        // Calculate dates
        const now = new Date();
        let periodEnd: Date;

        if (customEndDate) {
            periodEnd = new Date(customEndDate);
            console.log('📅 Using custom end date:', periodEnd);
        } else if (validityDays) {
            periodEnd = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);
            console.log('📅 Using custom validity days:', validityDays);
        } else {
            const defaultValidity = (plan as any).validityDays || 30;
            periodEnd = new Date(now.getTime() + defaultValidity * 24 * 60 * 60 * 1000);
            console.log('📅 Using default validity:', defaultValidity);
        }

        // Get existing subscription for logging
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
                billingCycle: 'manual',
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

        console.log('✅ Subscription created/updated:', subscription.id);

        // Update organization plan type
        await prisma.organization.update({
            where: { id: organizationId },
            data: { planType: plan.type },
        });

        console.log('✅ Organization planType updated to:', plan.type);

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
                    validityDays: validityDays || (plan as any).validityDays || 30,
                    periodStart: now.toISOString(),
                    periodEnd: periodEnd.toISOString(),
                    reason: reason || 'Manual assignment by admin',
                    assignedBy: adminName,
                    assignedAt: now.toISOString(),
                },
            },
        });

        console.log('✅ Activity log created');
        console.log('🔧 ========== ASSIGNMENT COMPLETE ==========\n');

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
            include: { plan: true, organization: true },
        });

        if (!subscription) {
            throw new AppError('No active subscription found', 404);
        }

        const now = new Date();
        const currentEnd = new Date(subscription.currentPeriodEnd);
        const extendFrom = currentEnd > now ? currentEnd : now;

        const newEndDate = new Date(extendFrom.getTime() + additionalDays * 24 * 60 * 60 * 1000);

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
    // REVOKE SUBSCRIPTION
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
    // GET ALL SUBSCRIPTIONS
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
            cancelledSubscriptions,
            planBreakdown,
        ] = await Promise.all([
            prisma.subscription.count(),
            prisma.subscription.count({
                where: { status: SubscriptionStatus.ACTIVE },
            }),
            prisma.subscription.count({
                where: { status: SubscriptionStatus.EXPIRED },
            }),
            prisma.subscription.count({
                where: { status: SubscriptionStatus.CANCELLED },
            }),
            prisma.subscription.groupBy({
                by: ['planId'],
                _count: true,
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

        // Get recent activity
        const recentActivity = await prisma.activityLog.findMany({
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
        });

        return {
            total: totalSubscriptions,
            active: activeSubscriptions,
            expired: expiredSubscriptions,
            cancelled: cancelledSubscriptions,
            planBreakdown: planStats,
            recentActivity,
        };
    }
}

export const adminBillingService = new AdminBillingService();
export default adminBillingService;