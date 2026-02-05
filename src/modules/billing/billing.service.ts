// src/modules/billing/billing.service.ts

import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { PlanType } from '@prisma/client';
import {
  CurrentPlanResponse,
  UsageStatsResponse,
  InvoiceResponse,
  PaymentMethodResponse,
  AvailablePlanResponse,
  UpgradePlanInput,
} from './billing.types';

export class BillingService {
  async getCurrentPlan(organizationId: string): Promise<CurrentPlanResponse> {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: { subscription: { include: { plan: true } } },
    });

    if (!organization) throw new AppError('Organization not found', 404);

    const plan = organization.subscription?.plan;
    const subscription = organization.subscription;

    if (!plan) {
      const freePlan = await prisma.plan.findUnique({ where: { type: 'FREE' } });
      if (!freePlan) throw new AppError('Free plan not found', 500);

      return {
        plan: {
          id: freePlan.id,
          name: freePlan.name,
          type: freePlan.type,
          description: freePlan.description,
          monthlyPrice: Number(freePlan.monthlyPrice),
          yearlyPrice: Number(freePlan.yearlyPrice),
          features: (freePlan.features as string[]) || [],
        },
        subscription: null,
        limits: {
          maxContacts: freePlan.maxContacts,
          maxMessages: freePlan.maxMessages,
          maxTeamMembers: freePlan.maxTeamMembers,
          maxCampaigns: freePlan.maxCampaigns,
          maxChatbots: freePlan.maxChatbots,
          maxTemplates: freePlan.maxTemplates,
        },
      };
    }

    return {
      plan: {
        id: plan.id,
        name: plan.name,
        type: plan.type,
        description: plan.description,
        monthlyPrice: Number(plan.monthlyPrice),
        yearlyPrice: Number(plan.yearlyPrice),
        features: (plan.features as string[]) || [],
      },
      subscription: subscription ? {
        id: subscription.id,
        status: subscription.status,
        billingCycle: subscription.billingCycle,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelledAt: subscription.cancelledAt,
      } : null,
      limits: {
        maxContacts: plan.maxContacts,
        maxMessages: plan.maxMessages,
        maxTeamMembers: plan.maxTeamMembers,
        maxCampaigns: plan.maxCampaigns,
        maxChatbots: plan.maxChatbots,
        maxTemplates: plan.maxTemplates,
      },
    };
  }

  // ✅ MAIN FIX: messages.unlimited flag + free-only warning logic support
  async getUsageStats(organizationId: string): Promise<UsageStatsResponse> {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        subscription: { include: { plan: true } },
        _count: { select: { contacts: true, members: true, campaigns: true, templates: true, chatbots: true } },
      },
    });

    if (!organization) throw new AppError('Organization not found', 404);

    const plan = organization.subscription?.plan;
    const subscription = organization.subscription;

    const isFreeDemo = (organization.planType === PlanType.FREE);

    // messages count this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const messagesThisMonth = await prisma.message.count({
      where: {
        conversation: { organizationId },
        direction: 'OUTBOUND',
        createdAt: { gte: startOfMonth },
      },
    });

    // limits
    const limits = {
      maxContacts: plan?.maxContacts || 100,
      maxMessages: plan?.maxMessages || (isFreeDemo ? 100 : 999999), // ✅ free default 100
      maxTeamMembers: plan?.maxTeamMembers || 1,
      maxCampaigns: plan?.maxCampaigns || 5,
      maxChatbots: plan?.maxChatbots || 1,
      maxTemplates: plan?.maxTemplates || 5,
    };

    // usage
    const usage = {
      contacts: organization._count.contacts,
      messages: subscription?.messagesUsed ?? messagesThisMonth,
      teamMembers: organization._count.members,
      campaigns: organization._count.campaigns,
      templates: organization._count.templates,
      chatbots: organization._count.chatbots,
    };

    const safePct = (used: number, limit: number) => {
      if (!limit || limit <= 0) return 0;
      return Math.round((used / limit) * 100);
    };

    return {
      contacts: {
        used: usage.contacts,
        limit: limits.maxContacts,
        percentage: safePct(usage.contacts, limits.maxContacts),
      },
      messages: {
        used: usage.messages,
        limit: limits.maxMessages,
        percentage: isFreeDemo ? safePct(usage.messages, limits.maxMessages) : 0,
        unlimited: !isFreeDemo, // ✅ Paid plans = unlimited => frontend banner should never show
      },
      teamMembers: {
        used: usage.teamMembers,
        limit: limits.maxTeamMembers,
        percentage: safePct(usage.teamMembers, limits.maxTeamMembers),
      },
      campaigns: {
        used: usage.campaigns,
        limit: limits.maxCampaigns,
        percentage: safePct(usage.campaigns, limits.maxCampaigns),
      },
      templates: {
        used: usage.templates,
        limit: limits.maxTemplates,
        percentage: safePct(usage.templates, limits.maxTemplates),
      },
      chatbots: {
        used: usage.chatbots,
        limit: limits.maxChatbots,
        percentage: safePct(usage.chatbots, limits.maxChatbots),
      },
    };
  }

  async getAvailablePlans(organizationId: string): Promise<AvailablePlanResponse[]> {
    const [plans, organization] = await Promise.all([
      prisma.plan.findMany({ where: { isActive: true }, orderBy: { monthlyPrice: 'asc' } }),
      prisma.organization.findUnique({ where: { id: organizationId } }),
    ]);

    const currentPlanType = organization?.planType || 'FREE';

    return plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      type: plan.type,
      description: plan.description,
      monthlyPrice: Number(plan.monthlyPrice),
      yearlyPrice: Number(plan.yearlyPrice),
      maxContacts: plan.maxContacts,
      maxMessages: plan.maxMessages,
      maxTeamMembers: plan.maxTeamMembers,
      maxCampaigns: plan.maxCampaigns,
      maxChatbots: plan.maxChatbots,
      maxTemplates: plan.maxTemplates,
      features: (plan.features as string[]) || [],
      isCurrentPlan: plan.type === currentPlanType,
      isPopular: plan.type === 'PRO',
    }));
  }

  async upgradePlan(
    organizationId: string,
    userId: string,
    input: UpgradePlanInput
  ): Promise<{ message: string; subscription: any }> {
    const { planType, billingCycle } = input;

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: { subscription: true },
    });
    if (!organization) throw new AppError('Organization not found', 404);
    if (organization.ownerId !== userId) throw new AppError('Only owner can upgrade plan', 403);

    const newPlan = await prisma.plan.findUnique({ where: { type: planType } });
    if (!newPlan) throw new AppError('Plan not found', 404);

    const now = new Date();
    const periodEnd = new Date();
    if (billingCycle === 'yearly') periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    else periodEnd.setMonth(periodEnd.getMonth() + 1);

    const subscription = await prisma.$transaction(async (tx) => {
      await tx.organization.update({ where: { id: organizationId }, data: { planType } });

      if (organization.subscription) {
        return tx.subscription.update({
          where: { id: organization.subscription.id },
          data: {
            planId: newPlan.id,
            status: 'ACTIVE',
            billingCycle,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            cancelledAt: null,
          },
        });
      }

      return tx.subscription.create({
        data: {
          organizationId,
          planId: newPlan.id,
          status: 'ACTIVE',
          billingCycle,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });
    });

    return { message: `Successfully upgraded to ${newPlan.name} plan`, subscription };
  }

  async cancelSubscription(organizationId: string, userId: string): Promise<{ message: string }> {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: { subscription: true },
    });

    if (!organization) throw new AppError('Organization not found', 404);
    if (organization.ownerId !== userId) throw new AppError('Only owner can cancel subscription', 403);
    if (!organization.subscription) throw new AppError('No active subscription', 400);
    if (organization.planType === 'FREE') throw new AppError('Cannot cancel free plan', 400);

    await prisma.subscription.update({
      where: { id: organization.subscription.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    return { message: 'Subscription cancelled. You will have access until the end of current period.' };
  }

  async getInvoices(organizationId: string, page = 1, limit = 10): Promise<{ invoices: InvoiceResponse[]; total: number }> {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: { subscription: { include: { plan: true } } },
    });

    if (!organization || !organization.subscription) return { invoices: [], total: 0 };

    const sub = organization.subscription;
    const plan = sub.plan;

    const invoices: InvoiceResponse[] = [];
    const monthsBack = 6;

    for (let i = 0; i < monthsBack; i++) {
      const invoiceDate = new Date();
      invoiceDate.setMonth(invoiceDate.getMonth() - i);

      invoices.push({
        id: `inv_${organizationId}_${i}`,
        invoiceNumber: `INV-${invoiceDate.getFullYear()}${String(invoiceDate.getMonth() + 1).padStart(2, '0')}-${String(i + 1).padStart(4, '0')}`,
        amount: sub.billingCycle === 'yearly' ? Number(plan.yearlyPrice) : Number(plan.monthlyPrice),
        currency: 'USD',
        status: i === 0 && sub.status === 'PAST_DUE' ? 'pending' : 'paid',
        planName: plan.name,
        billingCycle: sub.billingCycle,
        createdAt: invoiceDate,
        paidAt: i === 0 && sub.status === 'PAST_DUE' ? null : invoiceDate,
        downloadUrl: `/api/v1/billing/invoices/inv_${organizationId}_${i}/download`,
      });
    }

    const start = (page - 1) * limit;
    return { invoices: invoices.slice(start, start + limit), total: invoices.length };
  }

  async getPaymentMethods(_organizationId: string): Promise<PaymentMethodResponse[]> {
    return [
      {
        id: 'pm_1',
        type: 'card',
        last4: '4242',
        brand: 'Visa',
        expiryMonth: '12',
        expiryYear: '2025',
        isDefault: true,
        createdAt: new Date('2024-01-15'),
      },
    ];
  }

  async addPaymentMethod(_organizationId: string, input: any): Promise<PaymentMethodResponse> {
    return {
      id: `pm_${Date.now()}`,
      type: input.type,
      last4: input.details.cardNumber?.slice(-4) || '0000',
      brand: 'Visa',
      expiryMonth: input.details.expiryMonth,
      expiryYear: input.details.expiryYear,
      isDefault: input.isDefault || false,
      createdAt: new Date(),
    };
  }

  async deletePaymentMethod(_organizationId: string, _paymentMethodId: string): Promise<{ message: string }> {
    return { message: 'Payment method removed successfully' };
  }

  async setDefaultPaymentMethod(_organizationId: string, _paymentMethodId: string): Promise<{ message: string }> {
    return { message: 'Default payment method updated' };
  }
}

export const billingService = new BillingService();