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
} from './campaigns.types';
import { whatsappApi } from '../whatsapp/whatsapp.api';
import { v4 as uuidv4 } from 'uuid';
import { metaService } from '../meta/meta.service'; // ✅ ADDED: Import metaService

// ============================================
// HELPER FUNCTIONS
// ============================================

const digitsOnly = (p: string) => String(p || '').replace(/\D/g, '');
const toMetaLang = (lang: string) => (lang?.includes('_') ? lang : lang === 'en' ? 'en_US' : 'en_US');

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
          parameters: args.params.map((t) => ({ type: 'text', text: t })),
        },
      ]
      : [],
  },
});

const buildParamsFromContact = (contact: any, varCount: number) => {
  const fallback = [
    contact?.firstName || '',
    contact?.lastName || '',
    contact?.phone || '',
    contact?.email || '',
  ].filter(Boolean);

  const params: string[] = [];
  for (let i = 0; i < varCount; i++) params.push(fallback[i] || 'NA');
  return params;
};

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
    contactGroupId: campaign.ContactGroupId,
    contactGroupName: campaign.ContactGroup?.name || null,
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
  phone: cc.Contact?.phone || '',
  fullName: [cc.Contact?.firstName, cc.Contact?.lastName].filter(Boolean).join(' ') || cc.Contact?.phone || '',
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

    // Method 1: Try exact match (id + organizationId)
    if (whatsappAccountId) {
      waAccount = await prisma.whatsAppAccount.findFirst({
        where: {
          id: whatsappAccountId,
          organizationId
        },
      });

      if (waAccount) return waAccount;
    }

    // Method 2: Try by ID only (check if organizationId is missing/null)
    if (!waAccount && whatsappAccountId) {
      const byIdOnly = await prisma.whatsAppAccount.findUnique({
        where: { id: whatsappAccountId },
      });

      if (byIdOnly) {
        if (!byIdOnly.organizationId) {
          waAccount = await prisma.whatsAppAccount.update({
            where: { id: byIdOnly.id },
            data: { organizationId },
          });
          return waAccount;
        }

        if (byIdOnly.organizationId !== organizationId) {
          throw new AppError('WhatsApp account belongs to another organization', 403);
        }

        return byIdOnly;
      }
    }

    // Method 3: Try by phoneNumberId
    if (!waAccount && phoneNumberId) {
      waAccount = await prisma.whatsAppAccount.findFirst({
        where: {
          phoneNumberId,
          organizationId
        },
      });

      if (waAccount) return waAccount;

      const byPhoneNumberId = await prisma.whatsAppAccount.findFirst({
        where: { phoneNumberId },
      });

      if (byPhoneNumberId && !byPhoneNumberId.organizationId) {
        waAccount = await prisma.whatsAppAccount.update({
          where: { id: byPhoneNumberId.id },
          data: { organizationId },
        });
        return waAccount;
      }
    }

    // Method 4: Fallback - get default/first connected account for this org
    if (!waAccount) {
      waAccount = await prisma.whatsAppAccount.findFirst({
        where: {
          organizationId,
          status: 'CONNECTED',
        },
        orderBy: [
          { isDefault: 'desc' },
          { createdAt: 'desc' },
        ],
      });

      if (waAccount) return waAccount;
    }

    // Method 5: Last resort - any account for this org
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
  async create(organizationId: string, input: CreateCampaignInput): Promise<CampaignResponse> {
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

    // Validate template
    const template = await prisma.template.findFirst({
      where: { id: templateId, organizationId },
    });

    if (!template) {
      throw new AppError('Template not found', 404);
    }

    // Find WhatsApp Account
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

    // Validate contact group if provided
    if (contactGroupId) {
      const group = await prisma.contactGroup.findFirst({
        where: { id: contactGroupId, organizationId },
      });

      if (!group) {
        throw new AppError('Contact group not found', 404);
      }
    }

    // Gather target contacts
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

    // Create campaign with contacts
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
        },
        include: {
          template: { select: { name: true } },
          whatsappAccount: { select: { phoneNumber: true } },
          ContactGroup: { select: { name: true } },
        },
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
          ContactGroup: { select: { name: true } },
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
        ContactGroup: {
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

    return {
      ...formatCampaign(campaign),
      template: campaign.template,
      whatsappAccount: campaign.whatsappAccount,
      contactGroup: campaign.ContactGroup,
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
        ContactGroup: { select: { name: true } },
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

    if (campaign.status === 'RUNNING') {
      throw new AppError('Cannot delete running campaign. Pause or cancel it first.', 400);
    }

    await prisma.campaign.delete({
      where: { id: campaignId },
    });

    console.log(`✅ Campaign deleted: ${campaignId}`);

    return { message: 'Campaign deleted successfully' };
  }

  // ==========================================
  // START CAMPAIGN - ✅ FIXED
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

    // ✅ ADDED: Check token expiry BEFORE starting
    const now = new Date();
    if (campaign.whatsappAccount.tokenExpiresAt &&
      campaign.whatsappAccount.tokenExpiresAt < now) {
      throw new AppError(
        'WhatsApp account token expired. Please reconnect in Settings → WhatsApp.',
        400
      );
    }

    // ✅ ADDED: Verify token can be decrypted
    const accountData = await metaService.getAccountWithToken(
      campaign.whatsappAccountId
    );

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
        startedAt: campaign.startedAt || new Date()
      },
      include: {
        template: { select: { name: true, language: true, variables: true } },
        whatsappAccount: { select: { id: true, phoneNumber: true } },
        ContactGroup: { select: { name: true } },
      },
    });

    console.log(`🚀 Starting campaign: ${campaignId}`);

    // Fire-and-forget sending
    void this.processCampaignSending(organizationId, campaignId).catch((e) => {
      console.error('❌ Campaign send process failed:', e);
    });

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
        ContactGroup: { select: { name: true } },
      },
    });

    console.log(`⏸️ Campaign paused: ${campaignId}`);

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

    // ✅ ADDED: Verify token before resuming
    const accountData = await metaService.getAccountWithToken(
      campaign.whatsappAccountId
    );

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
        ContactGroup: { select: { name: true } },
      },
    });

    console.log(`▶️ Campaign resumed: ${campaignId}`);

    // Resume sending
    void this.processCampaignSending(organizationId, campaignId).catch((e) => {
      console.error('❌ Campaign resume send failed:', e);
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
        ContactGroup: { select: { name: true } },
      },
    });

    console.log(`❌ Campaign cancelled: ${campaignId}`);

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
          Contact: {
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

    // ✅ ADDED: Verify token before retry
    const accountData = await metaService.getAccountWithToken(
      campaign.whatsappAccountId
    );

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

      // Resume sending
      void this.processCampaignSending(organizationId, campaignId).catch((e) => {
        console.error('❌ Campaign retry send failed:', e);
      });
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
      where: {
        id: campaignId,
        organizationId,
      },
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
          audienceFilter: original.audienceFilter === null
            ? undefined
            : toJsonValue(original.audienceFilter),
          status: 'DRAFT',
          totalContacts: originalContacts.length,
        },
        include: {
          template: { select: { name: true } },
          whatsappAccount: { select: { phoneNumber: true } },
          ContactGroup: { select: { name: true } },
        },
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

    return formatCampaign(duplicate);
  }

  // ==========================================
  // PROCESS CAMPAIGN SENDING - ✅ COMPLETELY FIXED
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

    // ✅ FIX: Get DECRYPTED token using metaService
    const accountData = await metaService.getAccountWithToken(
      campaign.whatsappAccountId
    );

    if (!accountData) {
      console.error('❌ WhatsApp account not found or token unavailable');

      // Mark campaign as failed
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
        },
      });

      return;
    }

    const { account, accessToken } = accountData; // ✅ accessToken is now DECRYPTED

    // Verify token is valid format
    if (!accessToken.startsWith('EAA')) {
      console.error('❌ Invalid access token format:', accessToken.substring(0, 10) + '...');

      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
        },
      });

      return;
    }

    console.log('✅ Using decrypted token:', accessToken.substring(0, 10) + '...');

    const template = campaign.template;
    const templateName = template?.name;
    const templateLang = template?.language || 'en_US';

    if (!templateName) {
      console.error('❌ Campaign template missing');

      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
        },
      });

      return;
    }

    const vars = (template.variables as any[]) || [];
    const varCount = Array.isArray(vars) ? vars.length : 0;

    let batchCount = 0;
    const MAX_BATCHES = 100; // Prevent infinite loops
    let totalSent = 0;
    let totalFailed = 0;

    while (batchCount < MAX_BATCHES) {
      batchCount++;

      // Check campaign status before each batch
      const currentCampaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { status: true },
      });

      if (!currentCampaign || currentCampaign.status !== 'RUNNING') {
        console.log(`⚠️ Campaign stopped at batch ${batchCount} (status: ${currentCampaign?.status})`);
        break;
      }

      // Get pending contacts
      const pending = await prisma.campaignContact.findMany({
        where: { campaignId, status: 'PENDING' },
        take: 25, // Process 25 at a time
        orderBy: { createdAt: 'asc' },
        include: {
          Contact: {
            select: {
              id: true,
              phone: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
        },
      });

      if (!pending.length) {
        console.log(`✅ No more pending contacts (batch ${batchCount})`);
        break;
      }

      console.log(`📤 Processing batch ${batchCount}: ${pending.length} contacts`);

      // Process each contact
      for (const cc of pending) {
        const to = cc.Contact?.phone;

        if (!to) {
          await this.updateContactStatus(
            campaignId,
            cc.contactId,
            'FAILED',
            undefined,
            'Contact phone missing'
          );
          totalFailed++;
          continue;
        }

        try {
          // Build template parameters
          const params = buildParamsFromContact(cc.Contact, varCount);

          // Build message payload
          const payload = buildTemplateSendPayload({
            to,
            templateName,
            language: templateLang,
            params,
          });

          // ✅ FIX: Use DECRYPTED token
          const res = await whatsappApi.sendMessage(
            account.phoneNumberId,
            accessToken,  // ✅ Now plaintext!
            payload
          );

          const waMessageId = res?.messages?.[0]?.id;

          if (!waMessageId) {
            throw new Error('No message ID returned from WhatsApp API');
          }

          // Update contact status to SENT
          await this.updateContactStatus(
            campaignId,
            cc.contactId,
            'SENT',
            waMessageId
          );

          totalSent++;
          console.log(`✅ Message sent to ${to} (${waMessageId})`);

          // Rate limiting: ~80 messages/second max (WhatsApp limit)
          await new Promise((r) => setTimeout(r, 80));

        } catch (e: any) {
          console.error(`❌ Failed to send to ${to}:`, e.message);

          // Check if it's a token error (code 190)
          if (e?.response?.data?.error?.code === 190) {
            console.error('❌ OAuth token invalid - stopping campaign');

            // Mark account as disconnected
            await prisma.whatsAppAccount.update({
              where: { id: account.id },
              data: {
                status: 'DISCONNECTED',
                accessToken: null,
                tokenExpiresAt: null,
              },
            });

            // Mark campaign as failed
            await prisma.campaign.update({
              where: { id: campaignId },
              data: {
                status: 'FAILED',
                completedAt: new Date(),
              },
            });

            console.log(`❌ Campaign failed due to invalid token. Total sent: ${totalSent}, Total failed: ${totalFailed}`);

            return; // Stop processing entirely
          }

          // Check for rate limit error (code 130429)
          if (e?.response?.data?.error?.code === 130429) {
            console.warn('⚠️ Rate limit hit, waiting 60 seconds...');
            await new Promise((r) => setTimeout(r, 60000)); // Wait 1 minute
          }

          const reason = e?.response?.data?.error?.message || e?.message || 'Send failed';

          await this.updateContactStatus(
            campaignId,
            cc.contactId,
            'FAILED',
            undefined,
            reason
          );

          totalFailed++;
        }
      }
    }

    if (batchCount >= MAX_BATCHES) {
      console.warn(`⚠️ Campaign stopped: max batches (${MAX_BATCHES}) reached`);
    }

    console.log(`📊 Campaign ${campaignId} send process completed. Sent: ${totalSent}, Failed: ${totalFailed}`);

    // Check if campaign is complete
    await this.checkAndComplete(campaignId);
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
        }
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
        statusCounts.find(s => s.status === status)?._count || 0;

      const deliveryRate = totalSent > 0
        ? Number(((totalDelivered / totalSent) * 100).toFixed(1))
        : 0;

      const readRate = totalDelivered > 0
        ? Number(((totalRead / totalDelivered) * 100).toFixed(1))
        : 0;

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
      where: {
        id: campaignId,
        organizationId,
      },
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
  // UPDATE CAMPAIGN CONTACT STATUS
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
  // CHECK AND COMPLETE CAMPAIGN
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

      console.log(`✅ Campaign completed: ${campaignId}`);
    }
  }
}

export const campaignsService = new CampaignsService();