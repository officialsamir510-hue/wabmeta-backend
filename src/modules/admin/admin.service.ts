// src/modules/admin/admin.service.ts

import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { hashPassword, comparePassword } from '../../utils/password';
import { PlanType, UserStatus, SubscriptionStatus, Prisma } from '@prisma/client';
import { generateAdminToken } from './admin.middleware';
import {
  AdminLoginInput,
  CreateAdminInput,
  UpdateAdminInput,
  UsersQueryInput,
  UpdateUserInput,
  OrganizationsQueryInput,
  UpdateOrganizationInput,
  UpdateSubscriptionInput,
  CreatePlanInput,
  UpdatePlanInput,
  SystemSettingsInput,
  AdminResponse,
  AdminLoginResponse,
  AdminUserResponse,
  AdminOrganizationResponse,
  AdminDashboardStats,
  PlanResponse,
  ActivityLogResponse,
  SystemSettingsResponse,
} from './admin.types';

// In-memory system settings (use database in production)
let systemSettings: SystemSettingsResponse = {
  maintenanceMode: false,
  registrationEnabled: true,
  defaultPlan: 'FREE',
  maxOrganizationsPerUser: 5,
  maxContactsFreePlan: 100,
  maxMessagesFreePlan: 1000,
  lastUpdated: new Date(),
};

// ============================================
// HELPER FUNCTIONS
// ============================================

const formatAdmin = (admin: any): AdminResponse => ({
  id: admin.id,
  email: admin.email,
  name: admin.name,
  role: admin.role,
  isActive: admin.isActive,
  lastLoginAt: admin.lastLoginAt,
  createdAt: admin.createdAt,
});

const formatUser = (user: any): AdminUserResponse => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  phone: user.phone,
  avatar: user.avatar,
  status: user.status,
  emailVerified: user.emailVerified,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
  organizations: user.memberships?.map((m: any) => ({
    id: m.organization.id,
    name: m.organization.name,
    role: m.role,
  })) || [],
});

const formatOrganization = (org: any): AdminOrganizationResponse => ({
  id: org.id,
  name: org.name,
  slug: org.slug,
  logo: org.logo,
  planType: org.planType,
  owner: {
    id: org.owner.id,
    email: org.owner.email,
    firstName: org.owner.firstName,
  },
  memberCount: org._count?.members || 0,
  contactCount: org._count?.contacts || 0,
  messageCount: 0, // Would need to aggregate from conversations
  subscription: org.subscription ? {
    status: org.subscription.status,
    currentPeriodEnd: org.subscription.currentPeriodEnd,
    messagesUsed: org.subscription.messagesUsed,
    contactsUsed: org.subscription.contactsUsed,
  } : null,
  createdAt: org.createdAt,
});

const formatPlan = (plan: any): PlanResponse => ({
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
  features: plan.features as string[] || [],
  isActive: plan.isActive,
  subscriberCount: plan._count?.subscriptions || 0,
  createdAt: plan.createdAt,
});

// ============================================
// ADMIN SERVICE CLASS
// ============================================

export class AdminService {
  // ==========================================
  // ADMIN AUTH
  // ==========================================
  async login(input: AdminLoginInput): Promise<AdminLoginResponse> {
    const { email, password } = input;

    const admin = await prisma.adminUser.findUnique({
      where: { email },
    });

    if (!admin) {
      throw new AppError('Invalid email or password', 401);
    }

    const isValidPassword = await comparePassword(password, admin.password);
    if (!isValidPassword) {
      throw new AppError('Invalid email or password', 401);
    }

    if (!admin.isActive) {
      throw new AppError('Admin account is disabled', 403);
    }

    // Update last login
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    const token = generateAdminToken({
      id: admin.id,
      email: admin.email,
      role: admin.role,
    });

    return {
      admin: formatAdmin(admin),
      token,
    };
  }

  async createAdmin(input: CreateAdminInput): Promise<AdminResponse> {
    const { email, password, name, role } = input;

    const existing = await prisma.adminUser.findUnique({
      where: { email },
    });

    if (existing) {
      throw new AppError('Admin with this email already exists', 409);
    }

    const hashedPassword = await hashPassword(password);

    const admin = await prisma.adminUser.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: role || 'admin',
      },
    });

    return formatAdmin(admin);
  }

  async updateAdmin(adminId: string, input: UpdateAdminInput): Promise<AdminResponse> {
    const admin = await prisma.adminUser.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new AppError('Admin not found', 404);
    }

    const updateData: any = {
      name: input.name,
      email: input.email,
      role: input.role,
      isActive: input.isActive,
    };

    if (input.password) {
      updateData.password = await hashPassword(input.password);
    }

    const updated = await prisma.adminUser.update({
      where: { id: adminId },
      data: updateData,
    });

    return formatAdmin(updated);
  }

  async getAdmins(): Promise<AdminResponse[]> {
    const admins = await prisma.adminUser.findMany({
      orderBy: { createdAt: 'asc' },
    });

    return admins.map(formatAdmin);
  }

  async deleteAdmin(adminId: string): Promise<{ message: string }> {
    const admin = await prisma.adminUser.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new AppError('Admin not found', 404);
    }

    // Prevent deleting last super admin
    if (admin.role === 'super_admin') {
      const superAdminCount = await prisma.adminUser.count({
        where: { role: 'super_admin' },
      });

      if (superAdminCount <= 1) {
        throw new AppError('Cannot delete the last super admin', 400);
      }
    }

    await prisma.adminUser.delete({
      where: { id: adminId },
    });

    return { message: 'Admin deleted successfully' };
  }

  // ==========================================
  // DASHBOARD STATS
  // ==========================================
  async getDashboardStats(): Promise<AdminDashboardStats> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      totalUsers,
      activeUsers,
      pendingUsers,
      suspendedUsers,
      newUsersThisMonth,
      totalOrganizations,
      newOrgsThisMonth,
      planCounts,
      connectedWhatsApp,
      totalContacts,
      totalCampaigns,
      totalMessages,
      todayMessages,
      monthMessages,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count({ where: { status: 'PENDING_VERIFICATION' } }),
      prisma.user.count({ where: { status: 'SUSPENDED' } }),
      prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.organization.count(),
      prisma.organization.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.organization.groupBy({
        by: ['planType'],
        _count: { planType: true },
      }),
      prisma.whatsAppAccount.count({ where: { status: 'CONNECTED' } }),
      prisma.contact.count(),
      prisma.campaign.count(),
      prisma.message.count({ where: { direction: 'OUTBOUND' } }),
      prisma.message.count({
        where: { direction: 'OUTBOUND', createdAt: { gte: startOfDay } },
      }),
      prisma.message.count({
        where: { direction: 'OUTBOUND', createdAt: { gte: startOfMonth } },
      }),
    ]);

    const byPlan: Record<string, number> = {};
    planCounts.forEach((p) => {
      byPlan[p.planType] = p._count.planType;
    });

    // Calculate revenue (simplified - would need actual payment data)
    const subscriptions = await prisma.subscription.findMany({
      where: { status: 'ACTIVE' },
      include: { plan: true },
    });

    let mrr = 0;
    for (const sub of subscriptions) {
      mrr += Number(sub.plan.monthlyPrice);
    }

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        pending: pendingUsers,
        suspended: suspendedUsers,
        newThisMonth: newUsersThisMonth,
      },
      organizations: {
        total: totalOrganizations,
        byPlan,
        newThisMonth: newOrgsThisMonth,
      },
      messages: {
        totalSent: totalMessages,
        todaySent: todayMessages,
        thisMonthSent: monthMessages,
      },
      revenue: {
        mrr,
        arr: mrr * 12,
      },
      whatsapp: {
        connectedAccounts: connectedWhatsApp,
        totalContacts,
        totalCampaigns,
      },
    };
  }

  // ==========================================
  // USER MANAGEMENT
  // ==========================================
  async getUsers(query: UsersQueryInput): Promise<{ users: AdminUserResponse[]; total: number }> {
    const { page = 1, limit = 20, search, status, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          memberships: {
            include: {
              organization: {
                select: { id: true, name: true },
              },
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users: users.map(formatUser),
      total,
    };
  }

  async getUserById(userId: string): Promise<AdminUserResponse> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: {
            organization: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return formatUser(user);
  }

  async updateUser(userId: string, input: UpdateUserInput): Promise<AdminUserResponse> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        status: input.status,
        emailVerified: input.emailVerified,
      },
      include: {
        memberships: {
          include: {
            organization: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    return formatUser(updated);
  }

  async deleteUser(userId: string): Promise<{ message: string }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Delete user and cascade to related data
    await prisma.user.delete({
      where: { id: userId },
    });

    return { message: 'User deleted successfully' };
  }

  async suspendUser(userId: string): Promise<AdminUserResponse> {
    return this.updateUser(userId, { status: 'SUSPENDED' });
  }

  async activateUser(userId: string): Promise<AdminUserResponse> {
    return this.updateUser(userId, { status: 'ACTIVE' });
  }

  // ==========================================
  // ORGANIZATION MANAGEMENT
  // ==========================================
  async getOrganizations(query: OrganizationsQueryInput): Promise<{ organizations: AdminOrganizationResponse[]; total: number }> {
    const { page = 1, limit = 20, search, planType, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.OrganizationWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (planType) {
      where.planType = planType;
    }

    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          owner: {
            select: { id: true, email: true, firstName: true },
          },
          subscription: true,
          _count: {
            select: { members: true, contacts: true },
          },
        },
      }),
      prisma.organization.count({ where }),
    ]);

    return {
      organizations: organizations.map(formatOrganization),
      total,
    };
  }

  async getOrganizationById(orgId: string): Promise<AdminOrganizationResponse> {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        owner: {
          select: { id: true, email: true, firstName: true },
        },
        subscription: true,
        _count: {
          select: { members: true, contacts: true },
        },
      },
    });

    if (!org) {
      throw new AppError('Organization not found', 404);
    }

    return formatOrganization(org);
  }

  async updateOrganization(orgId: string, input: UpdateOrganizationInput): Promise<AdminOrganizationResponse> {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      throw new AppError('Organization not found', 404);
    }

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: {
        name: input.name,
        planType: input.planType,
      },
      include: {
        owner: {
          select: { id: true, email: true, firstName: true },
        },
        subscription: true,
        _count: {
          select: { members: true, contacts: true },
        },
      },
    });

    return formatOrganization(updated);
  }

  async deleteOrganization(orgId: string): Promise<{ message: string }> {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      throw new AppError('Organization not found', 404);
    }

    await prisma.organization.delete({
      where: { id: orgId },
    });

    return { message: 'Organization deleted successfully' };
  }

  // ==========================================
  // SUBSCRIPTION MANAGEMENT
  // ==========================================
  async updateSubscription(orgId: string, input: UpdateSubscriptionInput): Promise<AdminOrganizationResponse> {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: { subscription: true },
    });

    if (!org) {
      throw new AppError('Organization not found', 404);
    }

    if (!org.subscription) {
      throw new AppError('Organization has no subscription', 400);
    }

    await prisma.subscription.update({
      where: { id: org.subscription.id },
      data: {
        planId: input.planId,
        status: input.status,
        currentPeriodEnd: input.currentPeriodEnd ? new Date(input.currentPeriodEnd) : undefined,
        messagesUsed: input.messagesUsed,
        contactsUsed: input.contactsUsed,
      },
    });

    return this.getOrganizationById(orgId);
  }

  // ==========================================
  // PLAN MANAGEMENT
  // ==========================================
  async getPlans(): Promise<PlanResponse[]> {
    const plans = await prisma.plan.findMany({
      orderBy: { monthlyPrice: 'asc' },
      include: {
        _count: { select: { subscriptions: true } },
      },
    });

    return plans.map(formatPlan);
  }

  async createPlan(input: CreatePlanInput): Promise<PlanResponse> {
    const existing = await prisma.plan.findUnique({
      where: { type: input.type },
    });

    if (existing) {
      throw new AppError('Plan with this type already exists', 409);
    }

    const plan = await prisma.plan.create({
      data: {
        name: input.name,
        type: input.type,
        description: input.description,
        monthlyPrice: input.monthlyPrice,
        yearlyPrice: input.yearlyPrice,
        maxContacts: input.maxContacts,
        maxMessages: input.maxMessages,
        maxTeamMembers: input.maxTeamMembers,
        maxCampaigns: input.maxCampaigns,
        maxChatbots: input.maxChatbots,
        maxTemplates: input.maxTemplates,
        features: input.features,
      },
      include: {
        _count: { select: { subscriptions: true } },
      },
    });

    return formatPlan(plan);
  }

  async updatePlan(planId: string, input: UpdatePlanInput): Promise<PlanResponse> {
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new AppError('Plan not found', 404);
    }

    const updated = await prisma.plan.update({
      where: { id: planId },
      data: {
        name: input.name,
        description: input.description,
        monthlyPrice: input.monthlyPrice,
        yearlyPrice: input.yearlyPrice,
        maxContacts: input.maxContacts,
        maxMessages: input.maxMessages,
        maxTeamMembers: input.maxTeamMembers,
        maxCampaigns: input.maxCampaigns,
        maxChatbots: input.maxChatbots,
        maxTemplates: input.maxTemplates,
        features: input.features,
        isActive: input.isActive,
      },
      include: {
        _count: { select: { subscriptions: true } },
      },
    });

    return formatPlan(updated);
  }

  // ==========================================
  // ACTIVITY LOGS
  // ==========================================
  async getActivityLogs(query: {
    page?: number;
    limit?: number;
    action?: string;
    userId?: string;
    organizationId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ logs: ActivityLogResponse[]; total: number }> {
    const { page = 1, limit = 50, action, userId, organizationId, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ActivityLogWhereInput = {};

    if (action) {
      where.action = { contains: action };
    }

    if (userId) {
      where.userId = userId;
    }

    if (organizationId) {
      where.organizationId = organizationId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { email: true } },
          organization: { select: { name: true } },
        },
      }),
      prisma.activityLog.count({ where }),
    ]);

    return {
      logs: logs.map((log) => ({
        id: log.id,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        userId: log.userId,
        userEmail: log.user?.email || null,
        organizationId: log.organizationId,
        organizationName: log.organization?.name || null,
        metadata: log.metadata,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt,
      })),
      total,
    };
  }

  // ==========================================
  // SYSTEM SETTINGS
  // ==========================================
  getSystemSettings(): SystemSettingsResponse {
    return systemSettings;
  }

  updateSystemSettings(input: SystemSettingsInput): SystemSettingsResponse {
    systemSettings = {
      ...systemSettings,
      ...input,
      lastUpdated: new Date(),
    };
    return systemSettings;
  }
}

// Export singleton instance
export const adminService = new AdminService();