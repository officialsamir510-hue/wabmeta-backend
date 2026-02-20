// src/modules/billing/billing.service.ts

import { PrismaClient, PlanType, SubscriptionStatus } from '@prisma/client';
import crypto from 'crypto';

import prisma from '../../config/database';

// ============================================
// RAZORPAY INITIALIZATION
// ============================================

let razorpay: any = null;

const getRazorpayInstance = () => {
  if (!razorpay) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      console.warn('⚠️ Razorpay credentials not configured');
      console.warn('Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env');
      return null;
    }

    try {
      const Razorpay = require('razorpay');
      razorpay = new Razorpay({
        key_id: keyId,
        key_secret: keySecret
      });
      console.log('✅ Razorpay initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Razorpay:', error);
      return null;
    }
  }
  return razorpay;
};

class BillingService {
  // ============================================
  // GET SUBSCRIPTION
  // ============================================

  async getSubscription(organizationId: string) {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { organizationId },
        include: { plan: true }
      });

      if (!subscription) {
        // Return default free plan info
        const freePlan = await prisma.plan.findFirst({
          where: { type: PlanType.FREE }
        });

        return {
          plan: freePlan || {
            id: 'free',
            name: 'Free',
            type: 'FREE',
            slug: 'free',
            monthlyPrice: 0,
            yearlyPrice: 0,
            maxContacts: 100,
            maxMessagesPerMonth: 1000,
            maxCampaignsPerMonth: 5,
            maxTeamMembers: 1,
            maxWhatsAppAccounts: 1,
            maxTemplates: 5,
            maxChatbots: 1,
            maxAutomations: 3
          },
          status: 'active',
          billingCycle: 'monthly',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          messagesUsed: 0,
          contactsUsed: 0
        };
      }

      return {
        ...subscription,
        plan: subscription.plan || undefined
      };
    } catch (error) {
      console.error('Get subscription error:', error);
      throw error;
    }
  }

  // ============================================
  // GET PLANS
  // ============================================

  async getPlans() {
    try {
      const plans = await prisma.plan.findMany({
        where: { isActive: true },
        orderBy: { monthlyPrice: 'asc' }
      });

      // If no plans in DB, return default plans
      if (plans.length === 0) {
        console.log('No plans in database, using defaults');
        return this.getDefaultPlans();
      }

      return plans.map(plan => ({
        ...plan,
        popular: plan.type === PlanType.PRO,
        monthlyPrice: Number(plan.monthlyPrice) || 0,
        yearlyPrice: Number(plan.yearlyPrice) || 0,
        features: Array.isArray(plan.features) ? plan.features : []
      }));
    } catch (error) {
      console.error('Get plans error:', error);
      // Return default plans on error
      return this.getDefaultPlans();
    }
  }

  // ============================================
  // DEFAULT PLANS
  // ============================================

  private getDefaultPlans() {
    return [
      {
        id: 'free',
        name: 'Free',
        type: PlanType.FREE,
        slug: 'free',
        monthlyPrice: 0,
        yearlyPrice: 0,
        maxContacts: 100,
        maxMessagesPerMonth: 1000,
        maxCampaignsPerMonth: 5,
        maxTeamMembers: 1,
        maxWhatsAppAccounts: 1,
        maxTemplates: 5,
        maxChatbots: 1,
        maxAutomations: 3,
        features: ['Basic Support', 'Email Notifications'],
        isActive: true,
        popular: false
      },
      {
        id: 'starter',
        name: 'Starter',
        type: PlanType.STARTER,
        slug: 'starter',
        monthlyPrice: 999,
        yearlyPrice: 9990,
        maxContacts: 1000,
        maxMessagesPerMonth: 10000,
        maxCampaignsPerMonth: 20,
        maxTeamMembers: 3,
        maxWhatsAppAccounts: 1,
        maxTemplates: 20,
        maxChatbots: 3,
        maxAutomations: 10,
        features: ['Email Support', 'Basic Analytics', 'CSV Export'],
        isActive: true,
        popular: false
      },
      {
        id: 'pro',
        name: 'Professional',
        type: PlanType.PRO,
        slug: 'pro',
        monthlyPrice: 2999,
        yearlyPrice: 29990,
        maxContacts: 10000,
        maxMessagesPerMonth: 50000,
        maxCampaignsPerMonth: 100,
        maxTeamMembers: 10,
        maxWhatsAppAccounts: 3,
        maxTemplates: 100,
        maxChatbots: 10,
        maxAutomations: 50,
        features: [
          'Priority Support',
          'Advanced Analytics',
          'API Access',
          'Custom Branding',
          'Webhook Integration'
        ],
        isActive: true,
        popular: true
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        type: PlanType.ENTERPRISE,
        slug: 'enterprise',
        monthlyPrice: 9999,
        yearlyPrice: 99990,
        maxContacts: -1, // Unlimited
        maxMessagesPerMonth: -1,
        maxCampaignsPerMonth: -1,
        maxTeamMembers: -1,
        maxWhatsAppAccounts: 10,
        maxTemplates: -1,
        maxChatbots: -1,
        maxAutomations: -1,
        features: [
          '24/7 Phone Support',
          'Custom Analytics Dashboard',
          'Full API Access',
          'White Labeling',
          'Dedicated Account Manager',
          'SLA Guarantee',
          'Custom Integration'
        ],
        isActive: true,
        popular: false
      }
    ];
  }

  // ============================================
  // GET USAGE
  // ============================================

  async getUsage(organizationId: string) {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { organizationId },
        include: { plan: true }
      });

      const now = new Date();
      const periodStart = subscription?.currentPeriodStart ||
        new Date(now.getFullYear(), now.getMonth(), 1); // First day of month

      // Get actual usage counts with proper error handling
      const [contactCount, messageCount, campaignCount] = await Promise.all([
        prisma.contact.count({
          where: { organizationId }
        }).catch((err) => {
          console.error('Error counting contacts:', err);
          return 0;
        }),

        prisma.message.count({
          where: {
            conversation: { organizationId },
            direction: 'OUTBOUND',
            createdAt: { gte: periodStart }
          }
        }).catch((err) => {
          console.error('Error counting messages:', err);
          return 0;
        }),

        prisma.campaign.count({
          where: {
            organizationId,
            createdAt: { gte: periodStart }
          }
        }).catch((err) => {
          console.error('Error counting campaigns:', err);
          return 0;
        })
      ]);

      // Get limits from subscription or use free plan defaults
      const plan = subscription?.plan || this.getDefaultPlans()[0];
      const maxContacts = Number(plan.maxContacts) || 100;
      const maxMessages = Number(plan.maxMessagesPerMonth) || 1000;
      const maxCampaigns = Number(plan.maxCampaignsPerMonth) || 5;

      // Calculate percentage (handle unlimited -1 case)
      const calcPercentage = (used: number, limit: number): number => {
        if (limit === -1) return 0; // Unlimited
        if (limit === 0) return 100;
        return Math.min(Math.round((used / limit) * 100), 100);
      };

      return {
        messages: {
          used: messageCount,
          limit: maxMessages,
          percentage: calcPercentage(messageCount, maxMessages)
        },
        contacts: {
          used: contactCount,
          limit: maxContacts,
          percentage: calcPercentage(contactCount, maxContacts)
        },
        campaigns: {
          used: campaignCount,
          limit: maxCampaigns,
          percentage: calcPercentage(campaignCount, maxCampaigns)
        },
        storage: {
          used: 0,
          limit: 1000,
          percentage: 0
        }
      };
    } catch (error) {
      console.error('Get usage error:', error);
      // Return safe defaults on error
      return {
        messages: { used: 0, limit: 1000, percentage: 0 },
        contacts: { used: 0, limit: 100, percentage: 0 },
        campaigns: { used: 0, limit: 5, percentage: 0 },
        storage: { used: 0, limit: 1000, percentage: 0 }
      };
    }
  }

  // ============================================
  // CREATE RAZORPAY ORDER - FIXED
  // ============================================

  async createRazorpayOrder(params: {
    organizationId: string;
    userId: string;
    planKey: string;
    billingCycle: 'monthly' | 'yearly';
  }) {
    const { organizationId, userId, planKey, billingCycle } = params;

    console.log('Creating Razorpay order:', { organizationId, planKey, billingCycle });

    // Check Razorpay configuration
    const rzp = getRazorpayInstance();
    if (!rzp) {
      throw new Error('Payment gateway not configured. Please contact support.');
    }

    // Get plan by slug or type
    let plan = await prisma.plan.findFirst({
      where: {
        OR: [
          { slug: planKey.toLowerCase() },
          { type: planKey.toUpperCase() as PlanType }
        ],
        isActive: true
      }
    });

    // If plan not found in DB, check default plans
    if (!plan) {
      const defaultPlans = this.getDefaultPlans();
      const defaultPlan = defaultPlans.find(
        p => p.slug === planKey.toLowerCase() || p.type === planKey.toUpperCase()
      );

      if (!defaultPlan) {
        throw new Error(`Plan '${planKey}' not found`);
      }

      // Create plan in database for future use
      try {
        plan = await prisma.plan.create({
          data: {
            name: defaultPlan.name,
            type: defaultPlan.type as PlanType,
            slug: defaultPlan.slug,
            monthlyPrice: defaultPlan.monthlyPrice,
            yearlyPrice: defaultPlan.yearlyPrice,
            maxContacts: defaultPlan.maxContacts,
            maxMessages: defaultPlan.maxMessagesPerMonth,
            maxTeamMembers: defaultPlan.maxTeamMembers,
            maxCampaigns: defaultPlan.maxCampaignsPerMonth,
            maxChatbots: defaultPlan.maxChatbots,
            maxTemplates: defaultPlan.maxTemplates,
            maxWhatsAppAccounts: defaultPlan.maxWhatsAppAccounts,
            maxMessagesPerMonth: defaultPlan.maxMessagesPerMonth,
            maxCampaignsPerMonth: defaultPlan.maxCampaignsPerMonth,
            maxAutomations: defaultPlan.maxAutomations,
            maxApiCalls: 10000,
            features: defaultPlan.features,
            isActive: true
          }
        });
        console.log('✅ Created plan in database:', plan.name);
      } catch (createError) {
        console.error('Failed to create plan in DB:', createError);
        throw new Error('Failed to initialize plan. Please try again.');
      }
    }

    // Calculate price
    const price = billingCycle === 'yearly'
      ? Number(plan.yearlyPrice)
      : Number(plan.monthlyPrice);

    console.log('Plan details:', {
      planName: plan.name,
      price,
      billingCycle,
      planId: plan.id
    });

    // Validate price
    if (price <= 0) {
      throw new Error('Cannot create order for free plan');
    }

    try {
      // ✅ Generate short, valid receipt (max 40 chars for Razorpay)
      const timestamp = Date.now().toString().slice(-8); // Last 8 digits
      const orgShort = organizationId.replace(/-/g, '').slice(-6); // Clean and get last 6 chars
      const receipt = `wm_${orgShort}_${timestamp}`; // Format: wm_abc123_12345678 (max 18 chars)

      console.log('Generated receipt:', receipt, 'Length:', receipt.length);

      // Create Razorpay order
      const orderOptions = {
        amount: Math.round(price * 100), // Convert rupees to paise
        currency: 'INR',
        receipt: receipt,
        payment_capture: 1, // Auto capture payment
        notes: {
          organizationId,
          userId,
          planId: plan.id,
          planType: plan.type,
          billingCycle,
          planName: plan.name
        }
      };

      console.log('Creating order with options:', {
        ...orderOptions,
        amount: `₹${price} (${orderOptions.amount} paise)`
      });

      const order = await rzp.orders.create(orderOptions);

      console.log('✅ Razorpay order created successfully:', {
        id: order.id,
        amount: order.amount,
        receipt: order.receipt
      });

      // Return order details
      return {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        planId: plan.id,
        planName: plan.name,
        receipt: order.receipt
      };

    } catch (razorpayError: any) {
      console.error('❌ Razorpay order creation failed:', {
        error: razorpayError.error || razorpayError,
        message: razorpayError.message,
        statusCode: razorpayError.statusCode
      });

      // Parse Razorpay error
      let errorMessage = 'Failed to create payment order';

      if (razorpayError.error?.description) {
        errorMessage = razorpayError.error.description;
      } else if (razorpayError.message) {
        errorMessage = razorpayError.message;
      }

      // Check for common issues
      if (errorMessage.includes('receipt')) {
        errorMessage = 'Invalid receipt format. Please try again.';
      } else if (errorMessage.includes('amount')) {
        errorMessage = 'Invalid amount. Please contact support.';
      }

      throw new Error(errorMessage);
    }
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
    const {
      organizationId,
      userId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = params;

    console.log('Verifying payment:', {
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id
    });

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      throw new Error('Payment verification failed: Gateway not configured');
    }

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      console.error('❌ Signature mismatch:', {
        expected: expectedSignature.slice(0, 10) + '...',
        received: razorpay_signature.slice(0, 10) + '...'
      });
      throw new Error('Payment verification failed: Invalid signature');
    }

    console.log('✅ Signature verified');

    // Get Razorpay instance
    const rzp = getRazorpayInstance();
    if (!rzp) {
      throw new Error('Payment gateway not available');
    }

    try {
      // Fetch order details from Razorpay
      const order = await rzp.orders.fetch(razorpay_order_id);
      const notes = order.notes || {};

      console.log('Order notes:', notes);

      // Get plan from database
      const plan = await prisma.plan.findUnique({
        where: { id: notes.planId }
      });

      if (!plan) {
        throw new Error('Plan not found for this payment');
      }

      // Calculate subscription period
      const now = new Date();
      const periodEnd = notes.billingCycle === 'yearly'
        ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
        : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

      console.log('Creating/updating subscription:', {
        planId: plan.id,
        billingCycle: notes.billingCycle,
        periodEnd
      });

      // Update or create subscription
      const subscription = await prisma.subscription.upsert({
        where: { organizationId },
        create: {
          organizationId,
          planId: plan.id,
          status: SubscriptionStatus.ACTIVE,
          billingCycle: notes.billingCycle || 'monthly',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          paymentMethod: 'razorpay',
          lastPaymentAt: now,
          messagesUsed: 0,
          contactsUsed: 0
        },
        update: {
          planId: plan.id,
          status: SubscriptionStatus.ACTIVE,
          billingCycle: notes.billingCycle || 'monthly',
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

      console.log('✅ Subscription activated:', {
        subscriptionId: subscription.id,
        planName: plan.name,
        status: subscription.status
      });

      return {
        subscription,
        plan,
        message: 'Subscription activated successfully'
      };

    } catch (error: any) {
      console.error('❌ Payment verification error:', error);
      throw new Error(error.message || 'Payment verification failed');
    }
  }

  // ============================================
  // UPGRADE PLAN (Restored)
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
          { slug: planType },
        ],
      },
    });

    if (!plan) {
      throw new Error('Plan not found');
    }

    const price = billingCycle === 'yearly' ? Number(plan.yearlyPrice) : Number(plan.monthlyPrice);

    if (price > 0) {
      throw new Error('Please use Razorpay checkout for paid plans');
    }

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
        currentPeriodEnd: periodEnd,
      },
      update: {
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    });

    await prisma.organization.update({
      where: { id: organizationId },
      data: { planType: plan.type },
    });

    return subscription;
  }

  // ============================================
  // CANCEL SUBSCRIPTION
  // ============================================

  async cancelSubscription(organizationId: string, reason?: string) {
    try {
      const existingSubscription = await prisma.subscription.findUnique({
        where: { organizationId }
      });

      if (!existingSubscription) {
        throw new Error('No active subscription found');
      }

      if (existingSubscription.status === SubscriptionStatus.CANCELLED) {
        throw new Error('Subscription is already cancelled');
      }

      const subscription = await prisma.subscription.update({
        where: { organizationId },
        data: {
          status: SubscriptionStatus.CANCELLED,
          cancelledAt: new Date(),
          // cancellationReason: reason // Removed as it's not in schema
        }
      });

      // Log cancellation
      console.log('Subscription cancelled:', {
        organizationId,
        subscriptionId: subscription.id,
        reason
      });

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

      return {
        message: 'Subscription cancelled successfully. You will have access until the end of your billing period.',
        subscription
      };
    } catch (error: any) {
      console.error('Cancel subscription error:', error);
      throw new Error(error.message || 'Failed to cancel subscription');
    }
  }

  // ============================================
  // RESUME SUBSCRIPTION (Restored)
  // ============================================
  async resumeSubscription(organizationId: string) {
    const subscription = await prisma.subscription.update({
      where: { organizationId },
      data: {
        status: SubscriptionStatus.ACTIVE,
        cancelledAt: null,
      },
    });
    return subscription;
  }

  // ============================================
  // GET INVOICES (Restored)
  // ============================================
  async getInvoices(organizationId: string, limit: number = 10, offset: number = 0): Promise<any[]> {
    try {
      // For now, return mock data
      // In production, integrate with Razorpay invoices API
      return [];
    } catch (error) {
      console.error('Get invoices error:', error);
      return [];
    }
  }

  // ============================================
  // CHECK SUBSCRIPTION STATUS
  // ============================================

  async checkSubscriptionStatus(organizationId: string) {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { organizationId },
        include: { plan: true }
      });

      if (!subscription) {
        return { isActive: false, message: 'No subscription found' };
      }

      const now = new Date();
      const isExpired = subscription.currentPeriodEnd < now;
      const isCancelled = subscription.status === SubscriptionStatus.CANCELLED;

      if (isExpired || isCancelled) {
        // Update status if expired
        if (isExpired && subscription.status === SubscriptionStatus.ACTIVE) {
          await prisma.subscription.update({
            where: { organizationId },
            data: { status: SubscriptionStatus.EXPIRED }
          });
        }

        return {
          isActive: false,
          message: isExpired ? 'Subscription expired' : 'Subscription cancelled'
        };
      }

      return {
        isActive: true,
        subscription,
        daysRemaining: Math.ceil((subscription.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      };
    } catch (error) {
      console.error('Check subscription status error:', error);
      return { isActive: false, message: 'Error checking subscription' };
    }
  }

  // ============================================
  // GET SINGLE INVOICE (Restored)
  // ============================================
  async getInvoice(invoiceId: string, organizationId: string): Promise<any> {
    // TODO: Implement actual invoice retrieval
    throw new Error('Invoice not found');
  }

  // ============================================
  // GENERATE INVOICE PDF (Restored)
  // ============================================
  async generateInvoicePDF(invoiceId: string, organizationId: string): Promise<Buffer> {
    // TODO: Implement PDF generation
    throw new Error('Invoice PDF generation not implemented');
  }
}

export const billingService = new BillingService();
export default billingService;