// src/modules/billing/billing.service.ts

import { PrismaClient, PlanType, SubscriptionStatus } from '@prisma/client';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { config } from '../../config';

const prisma = new PrismaClient();

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: config.razorpay?.keyId || process.env.RAZORPAY_KEY_ID || '',
  key_secret: config.razorpay?.keySecret || process.env.RAZORPAY_KEY_SECRET || ''
});

class BillingService {
  // ============================================
  // GET SUBSCRIPTION
  // ============================================
  async getSubscription(organizationId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
      include: { plan: true }
    });

    if (!subscription) {
      // Return default free plan info
      const freePlan = await prisma.plan.findUnique({
        where: { type: PlanType.FREE }
      });

      return {
        plan: freePlan,
        status: 'active',
        billingCycle: 'monthly',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        messagesUsed: 0,
        contactsUsed: 0
      };
    }

    return subscription;
  }

  // ============================================
  // GET PLANS
  // ============================================
  async getPlans() {
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { monthlyPrice: 'asc' }
    });

    // Add popular flag to PRO plan
    return plans.map(plan => ({
      ...plan,
      popular: plan.type === PlanType.PRO,
      monthlyPrice: Number(plan.monthlyPrice),
      yearlyPrice: Number(plan.yearlyPrice)
    }));
  }

  // ============================================
  // GET USAGE
  // ============================================
  async getUsage(organizationId: string) {
    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
      include: { plan: true }
    });

    // Get actual usage counts
    const [contactCount, messageCount, campaignCount] = await Promise.all([
      prisma.contact.count({ where: { organizationId } }),
      prisma.message.count({
        where: {
          conversation: { organizationId },
          direction: 'OUTBOUND',
          createdAt: {
            gte: subscription?.currentPeriodStart || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      }),
      prisma.campaign.count({
        where: {
          organizationId,
          createdAt: {
            gte: subscription?.currentPeriodStart || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      })
    ]);

    const plan = subscription?.plan || await prisma.plan.findUnique({ where: { type: PlanType.FREE } });

    const maxContacts = plan?.maxContacts || 100;
    const maxMessages = plan?.maxMessagesPerMonth || 1000;
    const maxCampaigns = plan?.maxCampaignsPerMonth || 5;

    return {
      messages: {
        used: messageCount,
        limit: maxMessages,
        percentage: maxMessages === -1 ? 0 : Math.round((messageCount / maxMessages) * 100)
      },
      contacts: {
        used: contactCount,
        limit: maxContacts,
        percentage: maxContacts === -1 ? 0 : Math.round((contactCount / maxContacts) * 100)
      },
      campaigns: {
        used: campaignCount,
        limit: maxCampaigns,
        percentage: maxCampaigns === -1 ? 0 : Math.round((campaignCount / maxCampaigns) * 100)
      },
      storage: {
        used: 0, // TODO: Calculate actual storage
        limit: 1000, // MB
        percentage: 0
      }
    };
  }

  // ============================================
  // CREATE RAZORPAY ORDER
  // ============================================
  async createRazorpayOrder(params: {
    organizationId: string;
    userId: string;
    planKey: string;
    billingCycle: 'monthly' | 'yearly';
  }) {
    const { organizationId, userId, planKey, billingCycle } = params;

    // Get plan by slug or type
    const plan = await prisma.plan.findFirst({
      where: {
        OR: [
          { slug: planKey },
          { type: planKey.toUpperCase() as PlanType }
        ],
        isActive: true
      }
    });

    if (!plan) {
      throw new Error('Plan not found');
    }

    const price = billingCycle === 'yearly'
      ? Number(plan.yearlyPrice)
      : Number(plan.monthlyPrice);

    if (price <= 0) {
      throw new Error('Cannot create order for free plan');
    }

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: Math.round(price * 100), // Convert to paise
      currency: 'INR',
      receipt: `order_${organizationId}_${Date.now()}`,
      notes: {
        organizationId,
        userId,
        planId: plan.id,
        planType: plan.type,
        billingCycle
      }
    });

    return {
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      planId: plan.id,
      planName: plan.name
    };
  }

  // ============================================
  // VERIFY RAZORPAY PAYMENT
  // ============================================
  async verifyRazorpayPayment(params: {
    organizationId: string;
    userId: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) {
    const { organizationId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = params;

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', config.razorpay?.keySecret || process.env.RAZORPAY_KEY_SECRET || '')
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      throw new Error('Invalid payment signature');
    }

    // Fetch order details
    const order = await razorpay.orders.fetch(razorpay_order_id);
    const notes = order.notes as any;

    // Get plan
    const plan = await prisma.plan.findUnique({
      where: { id: notes.planId }
    });

    if (!plan) {
      throw new Error('Plan not found');
    }

    // Calculate period dates
    const now = new Date();
    const periodEnd = notes.billingCycle === 'yearly'
      ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
      : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Update or create subscription
    const subscription = await prisma.subscription.upsert({
      where: { organizationId },
      create: {
        organizationId,
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        billingCycle: notes.billingCycle,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        paymentMethod: 'razorpay',
        lastPaymentAt: now
      },
      update: {
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        billingCycle: notes.billingCycle,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        paymentMethod: 'razorpay',
        lastPaymentAt: now,
        cancelledAt: null
      }
    });

    // Update organization plan type
    await prisma.organization.update({
      where: { id: organizationId },
      data: { planType: plan.type }
    });

    return {
      subscription,
      plan,
      message: 'Subscription activated successfully'
    };
  }

  // ============================================
  // UPGRADE PLAN
  // ============================================
  async upgradePlan(params: {
    organizationId: string;
    planType: string;
    billingCycle?: string;
  }) {
    const { organizationId, planType, billingCycle = 'monthly' } = params;

    const plan = await prisma.plan.findFirst({
      where: {
        OR: [
          { type: planType.toUpperCase() as PlanType },
          { slug: planType }
        ]
      }
    });

    if (!plan) {
      throw new Error('Plan not found');
    }

    // For paid plans, return order creation info
    const price = billingCycle === 'yearly'
      ? Number(plan.yearlyPrice)
      : Number(plan.monthlyPrice);

    if (price > 0) {
      throw new Error('Please use Razorpay checkout for paid plans');
    }

    // For free plan, update directly
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const subscription = await prisma.subscription.upsert({
      where: { organizationId },
      create: {
        organizationId,
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        billingCycle,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd
      },
      update: {
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd
      }
    });

    await prisma.organization.update({
      where: { id: organizationId },
      data: { planType: plan.type }
    });

    return subscription;
  }

  // ============================================
  // CANCEL SUBSCRIPTION
  // ============================================
  async cancelSubscription(organizationId: string, reason?: string) {
    const subscription = await prisma.subscription.update({
      where: { organizationId },
      data: {
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: new Date()
      }
    });

    // Log cancellation reason
    if (reason) {
      await prisma.activityLog.create({
        data: {
          organizationId,
          action: 'UPDATE',
          entity: 'subscription',
          entityId: subscription.id,
          metadata: { reason }
        }
      });
    }

    return { message: 'Subscription will end at period end', subscription };
  }

  // ============================================
  // RESUME SUBSCRIPTION
  // ============================================
  async resumeSubscription(organizationId: string) {
    const subscription = await prisma.subscription.update({
      where: { organizationId },
      data: {
        status: SubscriptionStatus.ACTIVE,
        cancelledAt: null
      }
    });

    return subscription;
  }

  // ============================================
  // GET INVOICES
  // ============================================
  async getInvoices(organizationId: string, limit: number = 10, offset: number = 0): Promise<any[]> {
    // TODO: Implement actual invoice storage
    // For now, return empty array or mock data
    return [];
  }

  // ============================================
  // GET SINGLE INVOICE
  // ============================================
  async getInvoice(invoiceId: string, organizationId: string): Promise<any> {
    // TODO: Implement actual invoice retrieval
    throw new Error('Invoice not found');
  }

  // ============================================
  // GENERATE INVOICE PDF
  // ============================================
  async generateInvoicePDF(invoiceId: string, organizationId: string): Promise<Buffer> {
    // TODO: Implement PDF generation
    throw new Error('Invoice PDF generation not implemented');
  }
}

export const billingService = new BillingService();