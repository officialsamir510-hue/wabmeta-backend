// src/modules/billing/billing.types.ts

import { PlanType, SubscriptionStatus } from '@prisma/client';

// ============================================
// INPUT TYPES
// ============================================

export interface UpgradePlanInput {
  planType: PlanType;
  billingCycle: 'monthly' | 'yearly';
  paymentMethodId?: string;
}

export interface AddPaymentMethodInput {
  type: 'card' | 'upi' | 'bank';
  details: {
    cardNumber?: string;
    expiryMonth?: string;
    expiryYear?: string;
    cvv?: string;
    upiId?: string;
    accountNumber?: string;
    ifsc?: string;
  };
  isDefault?: boolean;
}

// ============================================
// RESPONSE TYPES
// ============================================

export interface CurrentPlanResponse {
  plan: {
    id: string;
    name: string;
    type: PlanType;
    description: string | null;
    monthlyPrice: number;
    yearlyPrice: number;
    features: string[];
  };
  subscription: {
    id: string;
    status: SubscriptionStatus;
    billingCycle: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelledAt: Date | null;
  } | null;
  limits: {
    maxContacts: number;
    maxMessages: number;
    maxTeamMembers: number;
    maxCampaigns: number;
    maxChatbots: number;
    maxTemplates: number;
  };
}

export interface UsageStatsResponse {
  contacts: {
    used: number;
    limit: number;
    percentage: number;
  };

  messages: {
    used: number;
    limit: number;
    percentage: number;
    unlimited?: boolean; // ✅ added for Unlimited* plans
  };

  teamMembers: {
    used: number;
    limit: number;
    percentage: number;
  };

  campaigns: {
    used: number;
    limit: number;
    percentage: number;
  };

  templates: {
    used: number;
    limit: number;
    percentage: number;
  };

  chatbots: {
    used: number;
    limit: number;
    percentage: number;
  };
}

export interface InvoiceResponse {
  id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed';
  planName: string;
  billingCycle: string;
  createdAt: Date;
  paidAt: Date | null;
  downloadUrl: string | null;
}

export interface PaymentMethodResponse {
  id: string;
  type: 'card' | 'upi' | 'bank';
  last4?: string;
  brand?: string;
  expiryMonth?: string;
  expiryYear?: string;
  upiId?: string;
  bankName?: string;
  isDefault: boolean;
  createdAt: Date;
}

export interface AvailablePlanResponse {
  id: string;
  name: string;
  type: PlanType;
  description: string | null;
  monthlyPrice: number;
  yearlyPrice: number;
  maxContacts: number;
  maxMessages: number;
  maxTeamMembers: number;
  maxCampaigns: number;
  maxChatbots: number;
  maxTemplates: number;
  features: string[];
  isCurrentPlan: boolean;
  isPopular: boolean;
}