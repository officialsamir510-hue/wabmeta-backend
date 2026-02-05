// src/modules/admin/admin.types.ts

import { User, Organization, PlanType, UserStatus, SubscriptionStatus } from '@prisma/client';

// ============================================
// REQUEST TYPES
// ============================================

export interface AdminLoginInput {
  email: string;
  password: string;
}

export interface CreateAdminInput {
  email: string;
  password: string;
  name: string;
  role?: 'admin' | 'super_admin';
}

export interface UpdateAdminInput {
  name?: string;
  email?: string;
  password?: string;
  role?: 'admin' | 'super_admin';
  isActive?: boolean;
}

// User Management
export interface UsersQueryInput {
  page?: number;
  limit?: number;
  search?: string;
  status?: UserStatus;
  sortBy?: 'createdAt' | 'email' | 'firstName' | 'lastLoginAt';
  sortOrder?: 'asc' | 'desc';
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  status?: UserStatus;
  emailVerified?: boolean;
}

// Organization Management
export interface OrganizationsQueryInput {
  page?: number;
  limit?: number;
  search?: string;
  planType?: PlanType;
  sortBy?: 'createdAt' | 'name' | 'planType';
  sortOrder?: 'asc' | 'desc';
}

export interface UpdateOrganizationInput {
  name?: string;
  planType?: PlanType;
}

// Subscription Management
export interface UpdateSubscriptionInput {
  planId: string;
  status?: SubscriptionStatus;
  currentPeriodEnd?: Date;
  messagesUsed?: number;
  contactsUsed?: number;
}

// System Settings
export interface SystemSettingsInput {
  maintenanceMode?: boolean;
  registrationEnabled?: boolean;
  defaultPlan?: PlanType;
  maxOrganizationsPerUser?: number;
  maxContactsFreePlan?: number;
  maxMessagesFreePlan?: number;
}

// Plan Management
export interface CreatePlanInput {
  name: string;
  type: PlanType;
  description?: string;
  monthlyPrice: number;
  yearlyPrice: number;
  maxContacts: number;
  maxMessages: number;
  maxTeamMembers: number;
  maxCampaigns: number;
  maxChatbots: number;
  maxTemplates: number;
  features: string[];
}

export interface UpdatePlanInput {
  name?: string;
  description?: string;
  monthlyPrice?: number;
  yearlyPrice?: number;
  maxContacts?: number;
  maxMessages?: number;
  maxTeamMembers?: number;
  maxCampaigns?: number;
  maxChatbots?: number;
  maxTemplates?: number;
  features?: string[];
  isActive?: boolean;
}

// ============================================
// RESPONSE TYPES
// ============================================

export interface AdminResponse {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export interface AdminLoginResponse {
  admin: AdminResponse;
  token: string;
}

export interface AdminUserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  avatar: string | null;
  status: UserStatus;
  emailVerified: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  organizations: {
    id: string;
    name: string;
    role: string;
  }[];
}

export interface AdminOrganizationResponse {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  planType: PlanType;
  owner: {
    id: string;
    email: string;
    firstName: string;
  };
  memberCount: number;
  contactCount: number;
  messageCount: number;
  subscription: {
    status: SubscriptionStatus;
    currentPeriodEnd: Date;
    messagesUsed: number;
    contactsUsed: number;
  } | null;
  createdAt: Date;
}

export interface AdminDashboardStats {
  users: {
    total: number;
    active: number;
    pending: number;
    suspended: number;
    newThisMonth: number;
  };
  organizations: {
    total: number;
    byPlan: Record<string, number>;
    newThisMonth: number;
  };
  messages: {
    totalSent: number;
    todaySent: number;
    thisMonthSent: number;
  };
  revenue: {
    mrr: number;
    arr: number;
  };
  whatsapp: {
    connectedAccounts: number;
    totalContacts: number;
    totalCampaigns: number;
  };
}

export interface PlanResponse {
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
  isActive: boolean;
  subscriberCount: number;
  createdAt: Date;
}

export interface ActivityLogResponse {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  userId: string | null;
  userEmail: string | null;
  organizationId: string | null;
  organizationName: string | null;
  metadata: any;
  ipAddress: string | null;
  createdAt: Date;
}

export interface SystemSettingsResponse {
  maintenanceMode: boolean;
  registrationEnabled: boolean;
  defaultPlan: PlanType;
  maxOrganizationsPerUser: number;
  maxContactsFreePlan: number;
  maxMessagesFreePlan: number;
  lastUpdated: Date;
}