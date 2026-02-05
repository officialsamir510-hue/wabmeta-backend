// src/modules/campaigns/campaigns.service.ts

import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { CampaignStatus, MessageStatus, Prisma } from '@prisma/client';
import {
  CreateCampaignInput,
  UpdateCampaignInput,
  CampaignsQueryInput,
  CampaignContactsQueryInput,
  CampaignResponse,
  CampaignDetailResponse,
  CampaignContactResponse,
  CampaignsListResponse,
  CampaignStats,
  CampaignAnalytics,
  AudienceFilter,
  VariableMapping,
} from './campaigns.types';

// ============================================
// HELPER FUNCTIONS
// ============================================

const calculateRates = (campaign: any): { deliveryRate: number; readRate: number } => {
  const deliveryRate = campaign.sentCount > 0
    ? Math.round((campaign.deliveredCount / campaign.sentCount) * 100)
    : 0;
  const readRate = campaign.deliveredCount > 0
    ? Math.round((campaign.readCount / campaign.deliveredCount) * 100)
    : 0;
  return { deliveryRate, readRate };
};

const formatCampaign = (campaign: any): CampaignResponse => {
  const { deliveryRate, readRate } = calculateRates(campaign);
  const pendingCount = campaign.totalContacts - campaign.sentCount - campaign.failedCount;

  return {
    id: campaign.id,
    name: campaign.name,
    description: campaign.description,
    templateId: campaign.templateId,
    templateName: campaign.template?.name || '',
    whatsappAccountId: campaign.whatsappAccountId,
    whatsappAccountPhone: campaign.whatsappAccount?.phoneNumber || '',
    contactGroupId: campaign.contactGroupId,
    contactGroupName: campaign.contactGroup?.name || null,
    audienceFilter: campaign.audienceFilter as AudienceFilter | null,
    variableMapping: null, // Not stored in DB currently
    status: campaign.status,
    scheduledAt: campaign.scheduledAt,
    startedAt: campaign.startedAt,
    completedAt: campaign.completedAt,
    totalContacts: campaign.totalContacts,
    sentCount: campaign.sentCount,
    deliveredCount: campaign.deliveredCount,
    readCount: campaign.readCount,
    failedCount: campaign.failedCount,
    pendingCount: pendingCount > 0 ? pendingCount : 0,
    deliveryRate,
    readRate,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
  };
};

const formatCampaignContact = (cc: any): CampaignContactResponse => ({
  id: cc.id,
  contactId: cc.contactId,
  phone: cc.contact?.phone || '',
  fullName: [cc.contact?.firstName, cc.contact?.lastName].filter(Boolean).join(' ') || cc.contact?.phone || '',
  status: cc.status,
  waMessageId: cc.waMessageId,
  sentAt: cc.sentAt,
  deliveredAt: cc.deliveredAt,
  readAt: cc.readAt,
  failedAt: cc.failedAt,
  failureReason: cc.failureReason,
  retryCount: cc.retryCount,
});

// Convert to Prisma JSON compatible format
const toJsonValue = (value: any): Prisma.InputJsonValue | undefined => {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value));
};

// ============================================
// CAMPAIGNS SERVICE CLASS
// ============================================

export class CampaignsService {
  // ==========================================
  // CREATE CAMPAIGN
  // ==========================================
  async create(organizationId: string, input: CreateCampaignInput): Promise<CampaignResponse> {
    const {
      name,
      description,
      templateId,
      whatsappAccountId,
      contactGroupId,
      contactIds,
      audienceFilter,
      scheduledAt,
      variableMapping,
    } = input;

    // Verify template exists and is approved
    const template = await prisma.template.findFirst({
      where: {
        id: templateId,
        organizationId,
      },
    });

    if (!template) {
      throw new AppError('Template not found', 404);
    }

    // For production, template should be approved
    // if (template.status !== 'APPROVED') {
    //   throw new AppError('Template must be approved before using in campaigns', 400);
    // }

    // Verify WhatsApp account
    const waAccount = await prisma.whatsAppAccount.findFirst({
      where: {
        id: whatsappAccountId,
        organizationId,
      },
    });

    if (!waAccount) {
      throw new AppError('WhatsApp account not found', 404);
    }

    // Verify contact group if provided
    if (contactGroupId) {
      const group = await prisma.contactGroup.findFirst({
        where: {
          id: contactGroupId,
          organizationId,
        },
      });

      if (!group) {
        throw new AppError('Contact group not found', 404);
      }
    }

    // Get contacts based on selection criteria
    let targetContacts: { id: string }[] = [];

    if (contactIds && contactIds.length > 0) {
      // Direct contact IDs
      targetContacts = await prisma.contact.findMany({
        where: {
          id: { in: contactIds },
          organizationId,
          status: 'ACTIVE',
        },
        select: { id: true },
      });
    } else if (contactGroupId) {
      // From contact group
      const groupMembers = await prisma.contactGroupMember.findMany({
        where: {
          groupId: contactGroupId,
          contact: {
            organizationId,
            status: 'ACTIVE',
          },
        },
        select: { contactId: true },
      });
      targetContacts = groupMembers.map((m) => ({ id: m.contactId }));
    } else if (audienceFilter) {
      // Based on filter
      const where: Prisma.ContactWhereInput = {
        organizationId,
        status: 'ACTIVE',
      };

      if (audienceFilter.tags && audienceFilter.tags.length > 0) {
        where.tags = { hasSome: audienceFilter.tags };
      }

      if (audienceFilter.createdAfter) {
        where.createdAt = { gte: new Date(audienceFilter.createdAfter) };
      }

      if (audienceFilter.createdBefore) {
        where.createdAt = {
          ...(where.createdAt as any),
          lte: new Date(audienceFilter.createdBefore),
        };
      }

      if (audienceFilter.hasMessaged !== undefined) {
        where.messageCount = audienceFilter.hasMessaged ? { gt: 0 } : { equals: 0 };
      }

      targetContacts = await prisma.contact.findMany({
        where,
        select: { id: true },
      });
    }

    if (targetContacts.length === 0) {
      throw new AppError('No contacts found for this campaign', 400);
    }

    // Check organization limits
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        subscription: {
          include: { plan: true },
        },
      },
    });

    // Create campaign with transaction
    const campaign = await prisma.$transaction(async (tx) => {
      // Create campaign
      const newCampaign = await tx.campaign.create({
        data: {
          organizationId,
          name,
          description,
          templateId,
          whatsappAccountId,
          contactGroupId,
          audienceFilter: toJsonValue(audienceFilter),
          status: scheduledAt ? 'SCHEDULED' : 'DRAFT',
          scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
          totalContacts: targetContacts.length,
        },
        include: {
          template: { select: { name: true } },
          whatsappAccount: { select: { phoneNumber: true } },
          contactGroup: { select: { name: true } },
        },
      });

      // Create campaign contacts
      const campaignContactsData = targetContacts.map((contact) => ({
        campaignId: newCampaign.id,
        contactId: contact.id,
        status: 'PENDING' as MessageStatus,
      }));

      await tx.campaignContact.createMany({
        data: campaignContactsData,
      });

      return newCampaign;
    });

    return formatCampaign(campaign);
  }

  // ==========================================
  // GET CAMPAIGNS LIST
  // ==========================================
  async getList(organizationId: string, query: CampaignsQueryInput): Promise<CampaignsListResponse> {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.CampaignWhereInput = {
      organizationId,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          template: { select: { name: true } },
          whatsappAccount: { select: { phoneNumber: true } },
          contactGroup: { select: { name: true } },
        },
      }),
      prisma.campaign.count({ where }),
    ]);

    return {
      campaigns: campaigns.map(formatCampaign),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ==========================================
  // GET CAMPAIGN BY ID
  // ==========================================
  async getById(organizationId: string, campaignId: string): Promise<CampaignDetailResponse> {
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        organizationId,
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            bodyText: true,
            headerType: true,
            headerContent: true,
          },
        },
        whatsappAccount: {
          select: {
            id: true,
            phoneNumber: true,
            displayName: true,
          },
        },
        contactGroup: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    const { deliveryRate, readRate } = calculateRates(campaign);
    const pendingCount = campaign.totalContacts - campaign.sentCount - campaign.failedCount;

    return {
      ...formatCampaign(campaign),
      template: campaign.template,
      whatsappAccount: campaign.whatsappAccount,
      contactGroup: campaign.contactGroup,
    };
  }

  // ==========================================
  // UPDATE CAMPAIGN
  // ==========================================
  async update(
    organizationId: string,
    campaignId: string,
    input: UpdateCampaignInput
  ): Promise<CampaignResponse> {
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        organizationId,
      },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    // Cannot update running or completed campaigns
    if (['RUNNING', 'COMPLETED'].includes(campaign.status)) {
      throw new AppError(`Cannot update ${campaign.status.toLowerCase()} campaign`, 400);
    }

    // Verify template if being changed
    if (input.templateId) {
      const template = await prisma.template.findFirst({
        where: {
          id: input.templateId,
          organizationId,
        },
      });

      if (!template) {
        throw new AppError('Template not found', 404);
      }
    }

    // Update campaign
    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        name: input.name,
        description: input.description,
        templateId: input.templateId,
        contactGroupId: input.contactGroupId,
        audienceFilter: toJsonValue(input.audienceFilter),
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
        status: input.scheduledAt ? 'SCHEDULED' : undefined,
      },
      include: {
        template: { select: { name: true } },
        whatsappAccount: { select: { phoneNumber: true } },
        contactGroup: { select: { name: true } },
      },
    });

    return formatCampaign(updated);
  }

  // ==========================================
  // DELETE CAMPAIGN
  // ==========================================
  async delete(organizationId: string, campaignId: string): Promise<{ message: string }> {
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        organizationId,
      },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    // Cannot delete running campaigns
    if (campaign.status === 'RUNNING') {
      throw new AppError('Cannot delete running campaign. Pause or cancel it first.', 400);
    }

    await prisma.campaign.delete({
      where: { id: campaignId },
    });

    return { message: 'Campaign deleted successfully' };
  }

  // ==========================================
  // START CAMPAIGN
  // ==========================================
  async start(organizationId: string, campaignId: string): Promise<CampaignResponse> {
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        organizationId,
      },
      include: {
        template: true,
        whatsappAccount: true,
      },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    if (!['DRAFT', 'SCHEDULED', 'PAUSED'].includes(campaign.status)) {
      throw new AppError(`Cannot start campaign with status: ${campaign.status}`, 400);
    }

    // Verify WhatsApp account is connected
    if (campaign.whatsappAccount.status !== 'CONNECTED') {
      throw new AppError('WhatsApp account is not connected', 400);
    }

    // Update campaign status
    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: 'RUNNING',
        startedAt: campaign.startedAt || new Date(),
      },
      include: {
        template: { select: { name: true } },
        whatsappAccount: { select: { phoneNumber: true } },
        contactGroup: { select: { name: true } },
      },
    });

    // TODO: Trigger actual message sending via queue (BullMQ)
    // This will be implemented in Part 7 (WhatsApp Integration)

    return formatCampaign(updated);
  }

  // ==========================================
  // PAUSE CAMPAIGN
  // ==========================================
  async pause(organizationId: string, campaignId: string): Promise<CampaignResponse> {
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        organizationId,
      },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    if (campaign.status !== 'RUNNING') {
      throw new AppError('Only running campaigns can be paused', 400);
    }

    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'PAUSED' },
      include: {
        template: { select: { name: true } },
        whatsappAccount: { select: { phoneNumber: true } },
        contactGroup: { select: { name: true } },
      },
    });

    return formatCampaign(updated);
  }

  // ==========================================
  // RESUME CAMPAIGN
  // ==========================================
  async resume(organizationId: string, campaignId: string): Promise<CampaignResponse> {
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        organizationId,
      },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    if (campaign.status !== 'PAUSED') {
      throw new AppError('Only paused campaigns can be resumed', 400);
    }

    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'RUNNING' },
      include: {
        template: { select: { name: true } },
        whatsappAccount: { select: { phoneNumber: true } },
        contactGroup: { select: { name: true } },
      },
    });

    return formatCampaign(updated);
  }

  // ==========================================
  // CANCEL CAMPAIGN
  // ==========================================
  async cancel(organizationId: string, campaignId: string): Promise<CampaignResponse> {
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        organizationId,
      },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    if (['COMPLETED', 'FAILED'].includes(campaign.status)) {
      throw new AppError('Campaign is already finished', 400);
    }

    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
      },
      include: {
        template: { select: { name: true } },
        whatsappAccount: { select: { phoneNumber: true } },
        contactGroup: { select: { name: true } },
      },
    });

    return formatCampaign(updated);
  }

  // ==========================================
  // GET CAMPAIGN CONTACTS
  // ==========================================
  async getContacts(
    organizationId: string,
    campaignId: string,
    query: CampaignContactsQueryInput
  ): Promise<{ contacts: CampaignContactResponse[]; meta: any }> {
    const { page = 1, limit = 50, status } = query;
    const skip = (page - 1) * limit;

    // Verify campaign belongs to organization
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        organizationId,
      },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    const where: Prisma.CampaignContactWhereInput = {
      campaignId,
    };

    if (status) {
      where.status = status;
    }

    const [contacts, total] = await Promise.all([
      prisma.campaignContact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          contact: {
            select: {
              phone: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.campaignContact.count({ where }),
    ]);

    return {
      contacts: contacts.map(formatCampaignContact),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ==========================================
  // RETRY FAILED MESSAGES
  // ==========================================
  async retry(
    organizationId: string,
    campaignId: string,
    retryFailed: boolean = true,
    retryPending: boolean = false
  ): Promise<{ message: string; retryCount: number }> {
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        organizationId,
      },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    const statusesToRetry: MessageStatus[] = [];
    if (retryFailed) statusesToRetry.push('FAILED');
    if (retryPending) statusesToRetry.push('PENDING');

    if (statusesToRetry.length === 0) {
      throw new AppError('No retry options selected', 400);
    }

    // Reset status and increment retry count
    const result = await prisma.campaignContact.updateMany({
      where: {
        campaignId,
        status: { in: statusesToRetry },
      },
      data: {
        status: 'PENDING',
        retryCount: { increment: 1 },
        failedAt: null,
        failureReason: null,
      },
    });

    // Update campaign status if it was completed/failed
    if (['COMPLETED', 'FAILED'].includes(campaign.status)) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'RUNNING' },
      });
    }

    return {
      message: `${result.count} messages queued for retry`,
      retryCount: result.count,
    };
  }

 // ==========================================
// DUPLICATE CAMPAIGN
// ==========================================
async duplicate(
  organizationId: string,
  campaignId: string,
  newName: string
): Promise<CampaignResponse> {
  const original = await prisma.campaign.findFirst({
    where: {
      id: campaignId,
      organizationId,
    },
  });

  if (!original) {
    throw new AppError('Campaign not found', 404);
  }

  // Get original contacts
  const originalContacts = await prisma.campaignContact.findMany({
    where: { campaignId },
    select: { contactId: true },
  });

  // Create duplicate campaign
  const duplicate = await prisma.$transaction(async (tx) => {
    const newCampaign = await tx.campaign.create({
      data: {
        organizationId,
        name: newName,
        description: original.description,
        templateId: original.templateId,
        whatsappAccountId: original.whatsappAccountId,
        contactGroupId: original.contactGroupId,
        audienceFilter: original.audienceFilter === null 
          ? undefined 
          : toJsonValue(original.audienceFilter),  // ✅ Fix here
        status: 'DRAFT',
        totalContacts: originalContacts.length,
      },
      include: {
        template: { select: { name: true } },
        whatsappAccount: { select: { phoneNumber: true } },
        contactGroup: { select: { name: true } },
      },
    });

    // Copy contacts
    if (originalContacts.length > 0) {
      await tx.campaignContact.createMany({
        data: originalContacts.map((c) => ({
          campaignId: newCampaign.id,
          contactId: c.contactId,
          status: 'PENDING' as MessageStatus,
        })),
      });
    }

    return newCampaign;
  });

  return formatCampaign(duplicate);
}

  // ==========================================
  // GET CAMPAIGN STATS
  // ==========================================
  async getStats(organizationId: string): Promise<CampaignStats> {
    const [
      total,
      draft,
      scheduled,
      running,
      completed,
      failed,
      paused,
      aggregates,
    ] = await Promise.all([
      prisma.campaign.count({ where: { organizationId } }),
      prisma.campaign.count({ where: { organizationId, status: 'DRAFT' } }),
      prisma.campaign.count({ where: { organizationId, status: 'SCHEDULED' } }),
      prisma.campaign.count({ where: { organizationId, status: 'RUNNING' } }),
      prisma.campaign.count({ where: { organizationId, status: 'COMPLETED' } }),
      prisma.campaign.count({ where: { organizationId, status: 'FAILED' } }),
      prisma.campaign.count({ where: { organizationId, status: 'PAUSED' } }),
      prisma.campaign.aggregate({
        where: { organizationId },
        _sum: {
          sentCount: true,
          deliveredCount: true,
          readCount: true,
        },
      }),
    ]);

    const totalSent = aggregates._sum.sentCount || 0;
    const totalDelivered = aggregates._sum.deliveredCount || 0;
    const totalRead = aggregates._sum.readCount || 0;

    return {
      total,
      draft,
      scheduled,
      running,
      completed,
      failed,
      paused,
      totalMessagesSent: totalSent,
      totalMessagesDelivered: totalDelivered,
      totalMessagesRead: totalRead,
      averageDeliveryRate: totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0,
      averageReadRate: totalDelivered > 0 ? Math.round((totalRead / totalDelivered) * 100) : 0,
    };
  }

  // ==========================================
  // GET CAMPAIGN ANALYTICS
  // ==========================================
  async getAnalytics(organizationId: string, campaignId: string): Promise<CampaignAnalytics> {
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        organizationId,
      },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    // Get status breakdown
    const statusCounts = await prisma.campaignContact.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: { status: true },
    });

    const totalContacts = campaign.totalContacts || 1;
    const statusBreakdown = statusCounts.map((s) => ({
      status: s.status,
      count: s._count.status,
      percentage: Math.round((s._count.status / totalContacts) * 100),
    }));

    // TODO: Implement hourly stats from message timestamps
    const hourlyStats: CampaignAnalytics['hourlyStats'] = [];

    return {
      hourlyStats,
      statusBreakdown,
    };
  }

  // ==========================================
  // UPDATE CAMPAIGN CONTACT STATUS (Internal)
  // ==========================================
  async updateContactStatus(
    campaignId: string,
    contactId: string,
    status: MessageStatus,
    waMessageId?: string,
    failureReason?: string
  ): Promise<void> {
    const now = new Date();

    const updateData: Prisma.CampaignContactUpdateInput = {
      status,
      waMessageId,
    };

    switch (status) {
      case 'SENT':
        updateData.sentAt = now;
        break;
      case 'DELIVERED':
        updateData.deliveredAt = now;
        break;
      case 'READ':
        updateData.readAt = now;
        break;
      case 'FAILED':
        updateData.failedAt = now;
        updateData.failureReason = failureReason;
        break;
    }

    await prisma.campaignContact.updateMany({
      where: {
        campaignId,
        contactId,
      },
      data: updateData,
    });

    // Update campaign counts
    const countField = `${status.toLowerCase()}Count`;
    if (['SENT', 'DELIVERED', 'READ', 'FAILED'].includes(status)) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          [countField]: { increment: 1 },
        },
      });
    }
  }

  // ==========================================
  // MARK CAMPAIGN COMPLETE (Internal)
  // ==========================================
  async checkAndComplete(campaignId: string): Promise<void> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign || campaign.status !== 'RUNNING') return;

    const pendingCount = await prisma.campaignContact.count({
      where: {
        campaignId,
        status: 'PENDING',
      },
    });

    if (pendingCount === 0) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });
    }
  }
}

// Export singleton instance
export const campaignsService = new CampaignsService();