// 📁 src/modules/campaigns/campaigns.service.ts - COMPLETE WITH ALL FIXES + SOCKET INTEGRATION

import { PrismaClient, CampaignStatus, MessageStatus, Prisma } from '@prisma/client';
import { AppError } from '../../middleware/errorHandler';
import { whatsappApi } from '../whatsapp/whatsapp.api';
import { metaService } from '../meta/meta.service';
import { campaignSocketService } from './campaigns.socket'; // ✅ Added
import { v4 as uuidv4 } from 'uuid';
import { messageQueueWorker } from '../../services/messageQueue.service';
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
} from './campaigns.types';

import prisma from '../../config/database';

// ============================================
// HELPER FUNCTIONS
// ============================================

const digitsOnly = (p: string): string => String(p || '').replace(/\D/g, '');

const toMetaLang = (lang?: string): string => {
  const l = String(lang || '').trim();
  return l || 'en_US';
};

const toRecipient = (c: any): string | null => {
  const phone = String(c?.phone || '').trim();
  if (!phone) return null;

  if (phone.startsWith('+')) return digitsOnly(phone);

  const digits = digitsOnly(phone);
  if (!digits) return null;

  if (digits.length > 10) return digits;

  const cc = digitsOnly(c?.countryCode || '91');
  return `${cc}${digits}`;
};

const buildTemplateSendPayload = (args: {
  to: string;
  templateName: string;
  language: string;
  params: string[];
}) => ({
  messaging_product: 'whatsapp',
  to: digitsOnly(args.to),
  type: 'template',
  template: {
    name: args.templateName,
    language: { code: toMetaLang(args.language) },
    components: args.params.length
      ? [
        {
          type: 'body',
          parameters: args.params.map((t) => ({ type: 'text', text: String(t) })),
        },
      ]
      : [],
  },
});

const buildParamsFromContact = (contact: any, varCount: number): string[] => {
  const fallback = [
    contact?.firstName || '',
    contact?.lastName || '',
    contact?.phone || '',
    contact?.email || '',
  ].filter(Boolean);

  const params: string[] = [];
  for (let i = 0; i < varCount; i++) {
    params.push(fallback[i] || 'NA');
  }
  return params;
};

const calculateRates = (campaign: any): { deliveryRate: number; readRate: number } => {
  const deliveryRate =
    campaign.sentCount > 0 ? Math.round((campaign.deliveredCount / campaign.sentCount) * 100) : 0;

  const readRate =
    campaign.deliveredCount > 0
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
    templateName: (campaign as any).template?.name || (campaign as any).Template?.name || '',
    whatsappAccountId: campaign.whatsappAccountId,
    whatsappAccountPhone:
      (campaign as any).whatsappAccount?.phoneNumber ||
      (campaign as any).WhatsAppAccount?.phoneNumber ||
      '',
    contactGroupId: campaign.contactGroupId,
    contactGroupName:
      (campaign as any).contactGroup?.name || (campaign as any).ContactGroup?.name || null,
    audienceFilter: campaign.audienceFilter as AudienceFilter | null,
    variableMapping: null,
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
  phone: (cc as any).contact?.phone || (cc as any).Contact?.phone || '',
  fullName:
    [
      (cc as any).contact?.firstName || (cc as any).Contact?.firstName,
      (cc as any).contact?.lastName || (cc as any).Contact?.lastName,
    ]
      .filter(Boolean)
      .join(' ') ||
    (cc as any).contact?.phone ||
    (cc as any).Contact?.phone ||
    '',
  status: cc.status,
  waMessageId: cc.waMessageId,
  sentAt: cc.sentAt,
  deliveredAt: cc.deliveredAt,
  readAt: cc.readAt,
  failedAt: cc.failedAt,
  failureReason: cc.failureReason,
  retryCount: cc.retryCount,
});

const toJsonValue = (value: any): Prisma.InputJsonValue | undefined => {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value));
};

// ============================================
// CAMPAIGNS SERVICE CLASS
// ============================================

export class CampaignsService {
  // ==========================================
  // FIND WHATSAPP ACCOUNT (ROBUST)
  // ==========================================
  private async findWhatsAppAccount(
    organizationId: string,
    whatsappAccountId?: string,
    phoneNumberId?: string
  ): Promise<any> {
    console.log('🔍 Finding WhatsApp account:', {
      organizationId,
      whatsappAccountId,
      phoneNumberId,
    });

    let waAccount = null;

    if (whatsappAccountId) {
      waAccount = await prisma.whatsAppAccount.findFirst({
        where: {
          id: whatsappAccountId,
          organizationId,
        },
      });

      if (waAccount) return waAccount;
    }

    if (!waAccount && phoneNumberId) {
      waAccount = await prisma.whatsAppAccount.findFirst({
        where: {
          phoneNumberId,
          organizationId,
        },
      });

      if (waAccount) return waAccount;
    }

    if (!waAccount) {
      waAccount = await prisma.whatsAppAccount.findFirst({
        where: {
          organizationId,
          status: 'CONNECTED',
        },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });

      if (waAccount) return waAccount;
    }

    if (!waAccount) {
      waAccount = await prisma.whatsAppAccount.findFirst({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
      });

      if (waAccount) return waAccount;
    }

    return null;
  }

  // ==========================================
  // CREATE CAMPAIGN
  // ==========================================
  async create(
    organizationId: string,
    userId: string,
    input: CreateCampaignInput
  ): Promise<CampaignResponse> {
    const {
      name,
      description,
      templateId,
      whatsappAccountId,
      phoneNumberId,
      contactGroupId,
      contactIds,
      audienceFilter,
      scheduledAt,
    } = input as any;

    console.log('📦 Campaign create request:', {
      organizationId,
      name,
      templateId,
      whatsappAccountId,
      phoneNumberId,
      contactIdsCount: contactIds?.length || 0,
    });

    const template = await prisma.template.findFirst({
      where: { id: templateId, organizationId },
    });

    if (!template) {
      throw new AppError('Template not found', 404);
    }

    if (template.status !== 'APPROVED') {
      throw new AppError(
        `Template is not approved yet (status: ${template.status}). Please wait for Meta approval.`,
        400
      );
    }

    if (!(template as any).metaTemplateId) {
      throw new AppError('Template is not synced from Meta. Please sync templates first.', 400);
    }

    const waAccount = await this.findWhatsAppAccount(
      organizationId,
      whatsappAccountId,
      phoneNumberId
    );

    if (!waAccount) {
      throw new AppError(
        'WhatsApp account not found. Please connect WhatsApp first in Settings → WhatsApp.',
        400
      );
    }

    if ((template as any).wabaId && waAccount?.wabaId && (template as any).wabaId !== waAccount.wabaId) {
      throw new AppError(
        'Selected template belongs to a different WABA. Please select a template for the connected number.',
        400
      );
    }

    if (contactGroupId) {
      const group = await prisma.contactGroup.findFirst({
        where: { id: contactGroupId, organizationId },
      });

      if (!group) {
        throw new AppError('Contact group not found', 404);
      }
    }

    let targetContacts: { id: string }[] = [];

    if (contactIds && contactIds.length > 0) {
      targetContacts = await prisma.contact.findMany({
        where: {
          id: { in: contactIds },
          organizationId,
          status: 'ACTIVE',
        },
        select: { id: true },
      });
    } else if (contactGroupId) {
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

    const campaign = await prisma.$transaction(async (tx) => {
      const newCampaign = await tx.campaign.create({
        data: {
          organizationId,
          name,
          description,
          templateId,
          whatsappAccountId: waAccount.id,
          contactGroupId,
          audienceFilter: toJsonValue(audienceFilter),
          status: scheduledAt ? 'SCHEDULED' : 'DRAFT',
          scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
          totalContacts: targetContacts.length,
          createdById: userId,
        } as any,
        include: {
          template: { select: { name: true } },
          whatsappAccount: { select: { phoneNumber: true } },
          contactGroup: { select: { name: true } },
        } as any,
      });

      const campaignContactsData = targetContacts.map((contact) => ({
        id: uuidv4(),
        campaignId: newCampaign.id,
        contactId: contact.id,
        status: 'PENDING' as MessageStatus,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      await tx.campaignContact.createMany({
        data: campaignContactsData,
      });

      return newCampaign;
    });

    console.log(`✅ Campaign created: ${campaign.id} with ${targetContacts.length} contacts`);

    // ✅ Emit campaign created event
    campaignSocketService.emitCampaignUpdate(organizationId, campaign.id, {
      status: campaign.status,
      message: 'Campaign created successfully',
      totalContacts: targetContacts.length,
    });

    return formatCampaign(campaign);
  }

  // ==========================================
  // GET CAMPAIGNS LIST
  // ==========================================
  async getList(
    organizationId: string,
    query: CampaignsQueryInput
  ): Promise<CampaignsListResponse> {
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
        } as any,
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
            language: true,
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
      } as any,
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    const c = campaign as any;
    return {
      ...formatCampaign(campaign),
      template: c.template || c.Template,
      whatsappAccount: c.whatsappAccount || c.WhatsAppAccount,
      contactGroup: c.contactGroup || c.ContactGroup,
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

    if (['RUNNING', 'COMPLETED'].includes(campaign.status)) {
      throw new AppError(`Cannot update ${campaign.status.toLowerCase()} campaign`, 400);
    }

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
      } as any,
    });

    // ✅ Emit campaign updated event
    campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
      status: updated.status,
      message: 'Campaign updated successfully',
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

    if (campaign.status === 'RUNNING') {
      throw new AppError('Cannot delete running campaign. Pause or cancel it first.', 400);
    }

    await prisma.campaign.delete({
      where: { id: campaignId },
    });

    console.log(`✅ Campaign deleted: ${campaignId}`);

    // ✅ Emit campaign deleted event
    campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
      status: 'DELETED',
      message: 'Campaign deleted successfully',
    });

    return { message: 'Campaign deleted successfully' };
  }

  // ==========================================
  // START CAMPAIGN - ✅ WITH SOCKET UPDATES
  // ==========================================
  async start(organizationId: string, campaignId: string): Promise<CampaignResponse> {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
      include: { template: true, whatsappAccount: true },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    if (!['DRAFT', 'SCHEDULED', 'PAUSED'].includes(campaign.status)) {
      throw new AppError(`Cannot start campaign with status: ${campaign.status}`, 400);
    }

    if (!campaign.whatsappAccount) {
      throw new AppError('WhatsApp account not found for this campaign', 400);
    }

    if (campaign.whatsappAccount.status !== 'CONNECTED') {
      throw new AppError('WhatsApp account is not connected', 400);
    }

    const accountData = await metaService.getAccountWithToken(campaign.whatsappAccountId);

    if (!accountData) {
      throw new AppError(
        'WhatsApp account token is invalid or unavailable. Please reconnect in Settings → WhatsApp.',
        400
      );
    }

    if (!accountData.accessToken.startsWith('EAA')) {
      throw new AppError(
        'WhatsApp account token is corrupted. Please reconnect in Settings → WhatsApp.',
        400
      );
    }

    console.log(`✅ Token validated for campaign: ${campaignId}`);

    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: 'RUNNING',
        startedAt: campaign.startedAt || new Date(),
      },
      include: {
        template: { select: { name: true, language: true, variables: true } },
        whatsappAccount: { select: { id: true, phoneNumber: true } },
        contactGroup: { select: { name: true } },
      } as any,
    });

    console.log(`🚀 Starting campaign: ${campaignId}`);

    // ✅ Emit campaign started event
    campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
      status: 'RUNNING',
      message: 'Campaign started successfully',
      totalContacts: updated.totalContacts,
    });

    // ✅ CRITICAL: Process in batches instead of loading all
    this.processCampaignInBatches(campaignId);

    return formatCampaign(updated);
  }

  // ==========================================
  // PAUSE/RESUME/CANCEL
  // ==========================================
  async pause(organizationId: string, campaignId: string): Promise<CampaignResponse> {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
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
      } as any,
    });

    console.log(`⏸️ Campaign paused: ${campaignId}`);

    // ✅ Emit campaign paused event
    campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
      status: 'PAUSED',
      message: 'Campaign paused',
    });

    return formatCampaign(updated);
  }

  async resume(organizationId: string, campaignId: string): Promise<CampaignResponse> {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    if (campaign.status !== 'PAUSED') {
      throw new AppError('Only paused campaigns can be resumed', 400);
    }

    const accountData = await metaService.getAccountWithToken(campaign.whatsappAccountId);

    if (!accountData || !accountData.accessToken.startsWith('EAA')) {
      throw new AppError(
        'WhatsApp account token is invalid. Please reconnect before resuming.',
        400
      );
    }

    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'RUNNING' },
      include: {
        template: { select: { name: true } },
        whatsappAccount: { select: { phoneNumber: true } },
        contactGroup: { select: { name: true } },
      } as any,
    });

    console.log(`▶️ Campaign resumed: ${campaignId}`);

    // ✅ Emit campaign resumed event
    campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
      status: 'RUNNING',
      message: 'Campaign resumed',
    });

    // Resume sending
    this.processCampaignInBatches(campaignId);

    return formatCampaign(updated);
  }

  async cancel(organizationId: string, campaignId: string): Promise<CampaignResponse> {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
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
      } as any,
    });

    console.log(`❌ Campaign cancelled: ${campaignId}`);

    // ✅ Emit campaign cancelled event
    campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
      status: 'FAILED',
      message: 'Campaign cancelled by user',
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

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
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
              countryCode: true,
              firstName: true,
              lastName: true,
            },
          },
        } as any,
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
      where: { id: campaignId, organizationId },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    const accountData = await metaService.getAccountWithToken(campaign.whatsappAccountId);

    if (!accountData || !accountData.accessToken.startsWith('EAA')) {
      throw new AppError(
        'WhatsApp account token is invalid. Please reconnect before retrying.',
        400
      );
    }

    const statusesToRetry: MessageStatus[] = [];
    if (retryFailed) statusesToRetry.push('FAILED');
    if (retryPending) statusesToRetry.push('PENDING');

    if (statusesToRetry.length === 0) {
      throw new AppError('No retry options selected', 400);
    }

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

    if (['COMPLETED', 'FAILED'].includes(campaign.status)) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'RUNNING' },
      });

      // ✅ Emit retry started event
      campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
        status: 'RUNNING',
        message: `Retrying ${result.count} messages`,
      });

      // Resume sending
      this.processCampaignInBatches(campaignId);
    }

    console.log(`🔄 Campaign retry: ${result.count} messages queued`);

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
      where: { id: campaignId, organizationId },
    });

    if (!original) {
      throw new AppError('Campaign not found', 404);
    }

    const originalContacts = await prisma.campaignContact.findMany({
      where: { campaignId },
      select: { contactId: true },
    });

    const duplicate = await prisma.$transaction(async (tx) => {
      const newCampaign = await tx.campaign.create({
        data: {
          organizationId,
          name: newName,
          description: original.description,
          templateId: original.templateId,
          whatsappAccountId: original.whatsappAccountId,
          contactGroupId: original.contactGroupId,
          audienceFilter:
            original.audienceFilter === null ? undefined : toJsonValue(original.audienceFilter),
          status: 'DRAFT',
          totalContacts: originalContacts.length,
          createdById: (original as any).createdById,
        } as any,
        include: {
          template: { select: { name: true } },
          whatsappAccount: { select: { phoneNumber: true } },
          contactGroup: { select: { name: true } },
        } as any,
      });

      if (originalContacts.length > 0) {
        await tx.campaignContact.createMany({
          data: originalContacts.map((c) => ({
            id: uuidv4(),
            campaignId: newCampaign.id,
            contactId: c.contactId,
            status: 'PENDING' as MessageStatus,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
        });
      }

      return newCampaign;
    });

    console.log(`📋 Campaign duplicated: ${campaignId} → ${duplicate.id}`);

    // ✅ Emit duplicate created event
    campaignSocketService.emitCampaignUpdate(organizationId, duplicate.id, {
      status: 'DRAFT',
      message: 'Campaign duplicated successfully',
      totalContacts: originalContacts.length,
    });

    return formatCampaign(duplicate);
  }

  // ==========================================
  // PROCESS CAMPAIGN IN BATCHES - ✅ OPTIMIZED
  // ==========================================
  private async processCampaignInBatches(campaignId: string) {
    const BATCH_SIZE = 100; // Process 100 at a time
    const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds

    let processedCount = 0;
    let hasMore = true;
    let lastId: string | undefined;

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        template: true,
        whatsappAccount: true,
      },
    });

    if (!campaign) return;

    while (hasMore) {
      // ✅ Check if campaign is still running
      const currentCampaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { status: true },
      });

      if (!currentCampaign || currentCampaign.status !== 'RUNNING') {
        console.log(`⚠️ Campaign ${campaignId} is no longer running, stopping batch processing.`);
        hasMore = false;
        break;
      }

      // ✅ Cursor-based pagination
      const contacts = await prisma.campaignContact.findMany({
        where: {
          campaignId,
          status: 'PENDING',
        },
        take: BATCH_SIZE,
        orderBy: { id: 'asc' }, // Better for cursor
        cursor: lastId ? { id: lastId } : undefined,
        skip: lastId ? 1 : 0,
      });

      if (contacts.length === 0) {
        hasMore = false;
        break;
      }

      // Process batch
      for (const contact of contacts) {
        try {
          // Add to message queue
          await messageQueueWorker.addToQueue({
            campaignId,
            contactId: contact.contactId,
            whatsappAccountId: campaign.whatsappAccountId,
            templateId: campaign.templateId,
            // You can add more data if needed
          });

          processedCount++;
        } catch (error) {
          console.error(`Failed to queue contact ${contact.id}:`, error);
        }
      }

      // Update last processed ID
      lastId = contacts[contacts.length - 1].id;

      // ✅ CRITICAL: Delay between batches to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES));

      console.log(`📊 Processed ${processedCount} contacts for campaign ${campaignId}`);
    }

    console.log(`✅ Campaign ${campaignId} queued: ${processedCount} contacts`);

    // If all queued, check if we should mark as COMPLETED
    // Actually the queue worker will handle updating the statuses,
    // so we might want to check for completion elsewhere or after some time.
  }

  // ==========================================
  // PROCESS CAMPAIGN SENDING - ✅ WITH SOCKET UPDATES
  // ==========================================
  private async processCampaignSending(organizationId: string, campaignId: string): Promise<void> {
    console.log(`📤 Starting send process for campaign: ${campaignId}`);

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
      include: { template: true, whatsappAccount: true },
    });

    if (!campaign) {
      console.error('❌ Campaign not found');
      return;
    }

    if (campaign.status !== 'RUNNING') {
      console.log(`⚠️ Campaign status is ${campaign.status}, stopping send process`);
      return;
    }

    const accountData = await metaService.getAccountWithToken(campaign.whatsappAccountId);

    if (!accountData) {
      console.error('❌ WhatsApp account not found or token unavailable');

      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
        },
      });

      campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
        status: 'FAILED',
        message: 'WhatsApp account token unavailable',
      });

      return;
    }

    const { account, accessToken } = accountData;

    if (!accessToken.startsWith('EAA')) {
      console.error('❌ Invalid access token format');

      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
        },
      });

      campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
        status: 'FAILED',
        message: 'Invalid access token format',
      });

      return;
    }

    console.log('✅ Using decrypted token:', accessToken.substring(0, 10) + '...');

    const template = campaign.template;
    const templateName = template?.name;
    const templateLang = toMetaLang(template?.language);

    console.log(`📝 Using template: ${templateName} (${templateLang})`);

    if (!templateName) {
      console.error('❌ Campaign template missing');

      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
        },
      });

      campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
        status: 'FAILED',
        message: 'Template missing',
      });

      return;
    }

    const vars = (template.variables as any[]) || [];
    const varCount = Array.isArray(vars) ? vars.length : 0;

    // ✅ Get total contacts count for progress tracking
    const totalContacts = await prisma.campaignContact.count({
      where: { campaignId },
    });

    let batchCount = 0;
    const MAX_BATCHES = 100;
    let totalSent = 0;
    let totalFailed = 0;

    // ✅ Emit initial progress
    campaignSocketService.emitCampaignProgress(organizationId, campaignId, {
      sent: 0,
      failed: 0,
      total: totalContacts,
      percentage: 0,
      status: 'RUNNING',
    });

    // Process campaigns in parallel batches
    const PARALLEL_LIMIT = 5;

    while (batchCount < MAX_BATCHES) {
      batchCount++;

      if (await this.shouldStopCampaign(campaignId)) {
        console.log(`⚠️ Campaign stopped at batch ${batchCount}`);
        break;
      }

      const pending = await prisma.campaignContact.findMany({
        where: { campaignId, status: 'PENDING' },
        take: 50, // Increased from 25
        orderBy: { createdAt: 'asc' },
        include: {
          contact: {
            select: {
              id: true,
              phone: true,
              countryCode: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        } as any,
      });

      if (!pending.length) {
        console.log(`✅ No more pending contacts`);
        break;
      }

      console.log(`📤 Processing batch ${batchCount}: ${pending.length} contacts`);

      for (let i = 0; i < pending.length; i += PARALLEL_LIMIT) {
        if (await this.shouldStopCampaign(campaignId)) break;

        const batch = pending.slice(i, i + PARALLEL_LIMIT);

        const results = await Promise.allSettled(
          batch.map(async (cc) => {
            const c = (cc as any).contact || (cc as any).Contact;
            const to = toRecipient(c);

            if (!to || to.length < 10) {
              await this.updateContactStatus(
                organizationId,
                campaignId,
                cc.contactId,
                'FAILED',
                undefined,
                'Contact phone missing, empty, or invalid format'
              );
              return { success: false, contactId: cc.contactId, error: 'Invalid phone number' };
            }

            const toDigits = digitsOnly(to);
            const fromDigits = digitsOnly(account.phoneNumber);

            if (toDigits && fromDigits && toDigits === fromDigits) {
              await this.updateContactStatus(
                organizationId,
                campaignId,
                cc.contactId,
                'FAILED',
                undefined,
                'Cannot send to business number (sender = recipient)'
              );
              return { success: false, contactId: cc.contactId, error: 'Cannot send to business number', phone: to };
            }

            try {
              const params = buildParamsFromContact(c, varCount);

              const payload = buildTemplateSendPayload({
                to,
                templateName,
                language: templateLang,
                params,
              });

              const res = await whatsappApi.sendMessage(account.phoneNumberId, accessToken, payload);
              const waMessageId = res?.messages?.[0]?.id;

              if (!waMessageId) {
                throw new Error('No message ID returned from WhatsApp API');
              }

              await this.updateContactStatus(
                organizationId,
                campaignId,
                cc.contactId,
                'SENT',
                waMessageId
              );

              // Sub-task: Save message with conversation
              void this.saveCampaignMessage(
                organizationId,
                campaignId,
                c.id,
                account.id,
                waMessageId,
                templateName,
                templateLang,
                params,
                template.id,
                campaign.name
              );

              return { success: true, contactId: cc.contactId, waMessageId, phone: to };
            } catch (e: any) {
              const metaErr = e?.response?.data?.error;
              const reason = metaErr?.message || e?.message || 'Send failed';

              await this.updateContactStatus(
                organizationId,
                campaignId,
                cc.contactId,
                'FAILED',
                undefined,
                reason
              );

              return { success: false, contactId: cc.contactId, error: reason, phone: to };
            }
          })
        );

        // Process results
        for (const result of results) {
          if (result.status === 'fulfilled') {
            if (result.value.success) {
              totalSent++;
              campaignSocketService.emitContactStatus(organizationId, campaignId, {
                contactId: result.value.contactId,
                phone: result.value.phone || '',
                status: 'SENT',
                messageId: result.value.waMessageId,
              });
            } else {
              totalFailed++;
              campaignSocketService.emitContactStatus(organizationId, campaignId, {
                contactId: result.value.contactId,
                phone: result.value.phone || 'unknown',
                status: 'FAILED',
                error: result.value.error,
              });
            }
          } else {
            totalFailed++;
          }
        }

        // Emit progress
        const percentage = Math.round(((totalSent + totalFailed) / totalContacts) * 100);
        campaignSocketService.emitCampaignProgress(organizationId, campaignId, {
          sent: totalSent,
          failed: totalFailed,
          total: totalContacts,
          percentage,
          status: 'RUNNING',
        });

        // Small delay between parallel batches
        await new Promise((r) => setTimeout(r, 40)); // Reduced from 80ms to 40ms
      }
    }

    console.log(
      `📊 Campaign ${campaignId} send process completed. Sent: ${totalSent}, Failed: ${totalFailed}`
    );

    await this.checkAndComplete(organizationId, campaignId);
  }

  private async shouldStopCampaign(campaignId: string): Promise<boolean> {
    const currentCampaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { status: true },
    });

    return !currentCampaign || currentCampaign.status !== 'RUNNING';
  }

  private async saveCampaignMessage(
    organizationId: string,
    campaignId: string,
    contactId: string,
    accountId: string,
    waMessageId: string,
    templateName: string,
    templateLang: string,
    params: string[],
    templateId: string,
    campaignName: string
  ): Promise<void> {
    try {
      let conversation = await prisma.conversation.findFirst({
        where: {
          organizationId,
          contactId,
        },
      });

      const now = new Date();
      const windowExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            organizationId,
            contactId,
            lastMessageAt: now,
            lastMessagePreview: `Template: ${templateName}`,
            lastCustomerMessageAt: null,
            windowExpiresAt: windowExpiry,
            isWindowOpen: true,
            unreadCount: 0,
            isRead: true,
          },
        });
        console.log(`✅ New conversation created: ${conversation.id}`);
      } else {
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            lastMessageAt: now,
            lastMessagePreview: `Template: ${templateName}`,
            windowExpiresAt: windowExpiry,
            isWindowOpen: true,
          },
        });
      }

      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          whatsappAccountId: accountId,
          waMessageId: waMessageId,
          wamId: waMessageId,
          direction: 'OUTBOUND',
          type: 'TEMPLATE',
          content: JSON.stringify({
            templateName,
            language: templateLang,
            params,
          }),
          status: 'SENT',
          templateId,
          sentAt: now,
          metadata: {
            campaignId,
            campaignName,
          },
        },
      });

      console.log(`💾 Campaign message saved with conversation: ${waMessageId}`);
    } catch (saveErr: any) {
      console.error('⚠️ Failed to save campaign message:', saveErr.message);
    }
  }

  // ==========================================
  // GET CAMPAIGN STATS
  // ==========================================
  async getStats(organizationId: string): Promise<CampaignStats> {
    try {
      const stats = await prisma.campaign.aggregate({
        where: { organizationId },
        _count: { id: true },
        _sum: {
          totalContacts: true,
          sentCount: true,
          deliveredCount: true,
          readCount: true,
          failedCount: true,
        },
      });

      const statusCounts = await prisma.campaign.groupBy({
        by: ['status'],
        where: { organizationId },
        _count: true,
      });

      const total = stats._count.id || 0;
      const totalSent = stats._sum.sentCount || 0;
      const totalDelivered = stats._sum.deliveredCount || 0;
      const totalRead = stats._sum.readCount || 0;

      const getStatusCount = (status: CampaignStatus) =>
        statusCounts.find((s) => s.status === status)?._count || 0;

      const deliveryRate =
        totalSent > 0 ? Number(((totalDelivered / totalSent) * 100).toFixed(1)) : 0;

      const readRate =
        totalDelivered > 0 ? Number(((totalRead / totalDelivered) * 100).toFixed(1)) : 0;

      return {
        total,
        draft: getStatusCount('DRAFT'),
        scheduled: getStatusCount('SCHEDULED'),
        running: getStatusCount('RUNNING'),
        completed: getStatusCount('COMPLETED'),
        failed: getStatusCount('FAILED'),
        paused: getStatusCount('PAUSED'),
        totalMessagesSent: totalSent,
        totalMessagesDelivered: totalDelivered,
        totalMessagesRead: totalRead,
        averageDeliveryRate: deliveryRate,
        averageReadRate: readRate,
      };
    } catch (error: any) {
      if (error.code === 'P2024') {
        return {
          total: 0,
          draft: 0,
          scheduled: 0,
          running: 0,
          completed: 0,
          failed: 0,
          paused: 0,
          totalMessagesSent: 0,
          totalMessagesDelivered: 0,
          totalMessagesRead: 0,
          averageDeliveryRate: 0,
          averageReadRate: 0,
        };
      }

      throw new AppError('Failed to fetch campaign statistics', 500);
    }
  }

  // ==========================================
  // GET CAMPAIGN ANALYTICS
  // ==========================================
  async getAnalytics(organizationId: string, campaignId: string): Promise<CampaignAnalytics> {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

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

    return {
      hourlyStats: [],
      statusBreakdown,
    };
  }

  // ==========================================
  // UPDATE CAMPAIGN CONTACT STATUS - ✅ WITH SOCKET
  // ==========================================
  async updateContactStatus(
    organizationId: string,
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

    const countField = `${status.toLowerCase()}Count`;
    if (['SENT', 'DELIVERED', 'READ', 'FAILED'].includes(status)) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          [countField]: { increment: 1 },
        },
      });
    }

    // ✅ Emit status update via socket
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { phone: true },
    });

    if (contact) {
      campaignSocketService.emitContactStatus(organizationId, campaignId, {
        contactId,
        phone: contact.phone,
        status,
        messageId: waMessageId,
        error: failureReason,
      });
    }
  }

  // ==========================================
  // CHECK AND COMPLETE CAMPAIGN - ✅ WITH SOCKET
  // ==========================================
  async checkAndComplete(organizationId: string, campaignId: string): Promise<void> {
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
      const updated = await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      console.log(`✅ Campaign completed: ${campaignId}`);

      // ✅ Emit campaign completed event
      campaignSocketService.emitCampaignCompleted(organizationId, campaignId, {
        sentCount: updated.sentCount,
        failedCount: updated.failedCount,
        deliveredCount: updated.deliveredCount,
        readCount: updated.readCount,
        totalRecipients: updated.totalContacts,
      });
    }
  }
}

export const campaignsService = new CampaignsService();