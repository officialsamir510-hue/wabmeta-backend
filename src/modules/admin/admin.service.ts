// src/modules/admin/admin.service.ts

import { PrismaClient, Prisma, PlanType, ActivityAction } from '@prisma/client';
import { hashPassword, comparePassword } from '../../utils/password';

const prisma = new PrismaClient();

class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

const generateAdminToken = (payload: any): string => {
  const jwt = require('jsonwebtoken');
  return jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
};

let systemSettings = {
  maintenanceMode: false,
  registrationEnabled: true,
  defaultPlan: 'FREE',
  maxOrganizationsPerUser: 5,
  lastUpdated: new Date(),
};

export class AdminService {
  // ==========================================
  // ADMIN AUTH
  // ==========================================
  async login(input: { email: string; password: string }) {
    const admin = await prisma.adminUser.findUnique({ where: { email: input.email } });
    if (!admin) throw new AppError('Invalid email or password', 401);

    const valid = await comparePassword(input.password, admin.password);
    if (!valid) throw new AppError('Invalid email or password', 401);
    if (!admin.isActive) throw new AppError('Admin account is disabled', 403);

    await prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });

    return {
      admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
      token: generateAdminToken({ id: admin.id, email: admin.email, role: admin.role }),
    };
  }

  async createAdmin(input: { email: string; password: string; name: string; role?: string }) {
    const existing = await prisma.adminUser.findUnique({ where: { email: input.email } });
    if (existing) throw new AppError('Admin already exists', 409);

    const admin = await prisma.adminUser.create({
      data: {
        email: input.email,
        password: await hashPassword(input.password),
        name: input.name,
        role: input.role || 'admin'
      },
    });

    return {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      isActive: admin.isActive
    };
  }

  async updateAdmin(id: string, input: any) {
    const data: any = {
      name: input.name,
      email: input.email,
      role: input.role,
      isActive: input.isActive
    };
    if (input.password) data.password = await hashPassword(input.password);

    const admin = await prisma.adminUser.update({ where: { id }, data });
    return {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      isActive: admin.isActive
    };
  }

  async getAdmins() {
    const admins = await prisma.adminUser.findMany({ orderBy: { createdAt: 'asc' } });
    return admins.map(a => ({
      id: a.id,
      email: a.email,
      name: a.name,
      role: a.role,
      isActive: a.isActive,
      lastLoginAt: a.lastLoginAt
    }));
  }

  async deleteAdmin(id: string) {
    await prisma.adminUser.delete({ where: { id } });
    return { message: 'Admin deleted successfully' };
  }

  // ==========================================
  // DASHBOARD
  // ==========================================
  async getDashboardStats() {
    const [totalUsers, activeUsers, totalOrgs, totalContacts, totalMessages] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.organization.count(),
      prisma.contact.count(),
      prisma.message.count(),
    ]);

    return {
      users: { total: totalUsers, active: activeUsers },
      organizations: { total: totalOrgs },
      contacts: { total: totalContacts },
      messages: { total: totalMessages },
    };
  }

  // ==========================================
  // USER MANAGEMENT
  // ==========================================
  async getUsers(query: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: string
  }) {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = query;

    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (status) {
      where.status = status as any;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder as 'asc' | 'desc' },
        include: {
          memberships: {
            include: {
              organization: {
                select: { id: true, name: true }
              }
            }
          }
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users: users.map(u => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        status: u.status,
        emailVerified: u.emailVerified,
        createdAt: u.createdAt,
        organizations: u.memberships?.map(m => ({
          id: m.organization.id,
          name: m.organization.name,
          role: m.role
        })) || [],
      })),
      total,
    };
  }

  async getUserById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        memberships: {
          include: {
            organization: {
              select: { id: true, name: true }
            }
          }
        }
      },
    });

    if (!user) throw new AppError('User not found', 404);

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      organizations: user.memberships?.map(m => ({
        id: m.organization.id,
        name: m.organization.name,
        role: m.role
      })) || [],
    };
  }

  async updateUser(id: string, input: any) {
    const user = await prisma.user.update({
      where: { id },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        status: input.status,
        emailVerified: input.emailVerified
      },
    });

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status
    };
  }

  async deleteUser(id: string) {
    await prisma.user.delete({ where: { id } });
    return { message: 'User deleted successfully' };
  }

  async suspendUser(id: string) {
    return this.updateUser(id, { status: 'SUSPENDED' });
  }

  async activateUser(id: string) {
    return this.updateUser(id, { status: 'ACTIVE' });
  }

  // ==========================================
  // ORGANIZATION MANAGEMENT
  // ==========================================
  async getOrganizations(query: {
    page?: number;
    limit?: number;
    search?: string;
    planType?: string;
    sortBy?: string;
    sortOrder?: string
  }) {
    const {
      page = 1,
      limit = 20,
      search,
      planType,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = query;

    const where: Prisma.OrganizationWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (planType) {
      where.planType = planType as PlanType;
    }

    const [orgs, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder as 'asc' | 'desc' },
        include: {
          owner: {
            select: { id: true, email: true, firstName: true }
          },
          _count: {
            select: { members: true, contacts: true }
          }
        },
      }),
      prisma.organization.count({ where }),
    ]);

    return {
      organizations: orgs.map(o => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        planType: o.planType,
        owner: o.owner,
        memberCount: o._count?.members || 0,
        contactCount: o._count?.contacts || 0,
        createdAt: o.createdAt,
      })),
      total,
    };
  }

  async getOrganizationById(id: string) {
    const org = await prisma.organization.findUnique({
      where: { id },
      include: {
        owner: {
          select: { id: true, email: true, firstName: true }
        },
        _count: {
          select: { members: true, contacts: true }
        }
      },
    });

    if (!org) throw new AppError('Organization not found', 404);

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      planType: org.planType,
      owner: org.owner,
      memberCount: org._count?.members || 0,
      contactCount: org._count?.contacts || 0
    };
  }

  async updateOrganization(id: string, input: any) {
    const org = await prisma.organization.update({
      where: { id },
      data: {
        name: input.name,
        planType: input.planType
      }
    });

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      planType: org.planType
    };
  }

  async deleteOrganization(id: string) {
    await prisma.organization.delete({ where: { id } });
    return { message: 'Organization deleted successfully' };
  }

  async updateSubscription(id: string, input: any) {
    const org = await prisma.organization.findUnique({
      where: { id },
      include: { subscription: true }
    });

    if (!org?.subscription) throw new AppError('No subscription found', 400);

    await prisma.subscription.update({
      where: { id: org.subscription.id },
      data: {
        planId: input.planId,
        status: input.status
      }
    });

    return this.getOrganizationById(id);
  }

  // ==========================================
  // PLAN MANAGEMENT
  // ==========================================
  async getPlans() {
    const plans = await prisma.plan.findMany({ orderBy: { monthlyPrice: 'asc' } });
    return plans.map(p => ({
      id: p.id,
      name: p.name,
      type: p.type,
      description: p.description,
      monthlyPrice: Number(p.monthlyPrice),
      yearlyPrice: Number(p.yearlyPrice),
      maxContacts: p.maxContacts,
      maxMessages: p.maxMessagesPerMonth,
      maxTeamMembers: p.maxTeamMembers,
      features: p.features as string[] || [],
      isActive: p.isActive,
    }));
  }

  async createPlan(input: any) {
    // ✅ All required fields from schema
    const plan = await prisma.plan.create({
      data: {
        name: input.name,
        slug: input.slug || input.name.toLowerCase().replace(/\s+/g, '-'),
        type: input.type as PlanType,
        description: input.description || null,
        monthlyPrice: input.monthlyPrice,
        yearlyPrice: input.yearlyPrice,
        maxWhatsAppAccounts: input.maxWhatsAppAccounts || 1,
        maxContacts: input.maxContacts || 100,
        maxMessagesPerMonth: input.maxMessages || input.maxMessagesPerMonth || 1000,
        maxMessages: input.maxMessages || input.maxMessagesPerMonth || 1000, // Added to satisfy schema
        maxCampaignsPerMonth: input.maxCampaigns || input.maxCampaignsPerMonth || 5,
        maxCampaigns: input.maxCampaigns || input.maxCampaignsPerMonth || 5, // Added to satisfy schema
        maxTeamMembers: input.maxTeamMembers || 1,
        maxTemplates: input.maxTemplates || 5,
        maxChatbots: input.maxChatbots || 1,
        maxAutomations: input.maxAutomations || 3,
        maxApiCalls: input.maxApiCalls || 10000,
        features: input.features || [],
        isActive: input.isActive !== undefined ? input.isActive : true,
      },
    });

    return {
      id: plan.id,
      name: plan.name,
      type: plan.type,
      monthlyPrice: Number(plan.monthlyPrice),
      yearlyPrice: Number(plan.yearlyPrice),
      maxContacts: plan.maxContacts,
      maxMessages: plan.maxMessagesPerMonth,
      isActive: plan.isActive,
    };
  }

  async updatePlan(id: string, input: any) {
    const updateData: any = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.monthlyPrice !== undefined) updateData.monthlyPrice = input.monthlyPrice;
    if (input.yearlyPrice !== undefined) updateData.yearlyPrice = input.yearlyPrice;
    if (input.maxContacts !== undefined) updateData.maxContacts = input.maxContacts;
    if (input.maxMessages !== undefined) updateData.maxMessagesPerMonth = input.maxMessages;
    if (input.maxTeamMembers !== undefined) updateData.maxTeamMembers = input.maxTeamMembers;
    if (input.maxTemplates !== undefined) updateData.maxTemplates = input.maxTemplates;
    if (input.maxChatbots !== undefined) updateData.maxChatbots = input.maxChatbots;
    if (input.features !== undefined) updateData.features = input.features;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;

    const plan = await prisma.plan.update({
      where: { id },
      data: updateData,
    });

    return {
      id: plan.id,
      name: plan.name,
      type: plan.type,
      isActive: plan.isActive
    };
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
    endDate?: string
  }) {
    const {
      page = 1,
      limit = 50,
      action,
      userId,
      organizationId,
      startDate,
      endDate
    } = query;

    const where: Prisma.ActivityLogWhereInput = {};

    // ✅ Fix: Use proper enum value, not 'contains'
    if (action) {
      where.action = action as ActivityAction;
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
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { email: true } },
          organization: { select: { name: true } }
        },
      }),
      prisma.activityLog.count({ where }),
    ]);

    // ✅ Fix: Transform nulls to match ActivityLogResponse type
    return {
      logs: logs.map(l => ({
        id: l.id,
        action: l.action ? String(l.action) : 'UNKNOWN',
        entity: l.entity,
        entityId: l.entityId,
        userId: l.userId,
        userEmail: l.user?.email || '',  // ✅ Not null
        organizationId: l.organizationId,
        organizationName: l.organization?.name || '',  // ✅ Not null
        metadata: l.metadata,
        ipAddress: l.ipAddress,
        createdAt: l.createdAt,
      })),
      total,
    };
  }

  // ==========================================
  // SYSTEM SETTINGS
  // ==========================================
  getSystemSettings() {
    return systemSettings;
  }

  updateSystemSettings(input: any) {
    systemSettings = {
      ...systemSettings,
      ...input,
      lastUpdated: new Date()
    };
    return systemSettings;
  }
}

export const adminService = new AdminService();