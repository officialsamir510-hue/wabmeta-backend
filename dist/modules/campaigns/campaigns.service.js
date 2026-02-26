"use strict";
// 📁 src/modules/campaigns/campaigns.service.ts - COMPLETE WITH ALL FIXES + SOCKET INTEGRATION
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.campaignsService = exports.CampaignsService = void 0;
const errorHandler_1 = require("../../middleware/errorHandler");
const meta_service_1 = require("../meta/meta.service");
const campaigns_socket_1 = require("./campaigns.socket"); // ✅ Added
const uuid_1 = require("uuid");
const messageQueue_service_1 = require("../../services/messageQueue.service");
const database_1 = __importDefault(require("../../config/database"));
// ============================================
// HELPER FUNCTIONS
// ============================================
const digitsOnly = (p) => String(p || '').replace(/\D/g, '');
const toMetaLang = (lang) => {
    const l = String(lang || '').trim();
    return l || 'en_US';
};
const toRecipient = (c) => {
    const phone = String(c?.phone || '').trim();
    if (!phone)
        return null;
    if (phone.startsWith('+'))
        return digitsOnly(phone);
    const digits = digitsOnly(phone);
    if (!digits)
        return null;
    if (digits.length > 10)
        return digits;
    const cc = digitsOnly(c?.countryCode || '91');
    return `${cc}${digits}`;
};
const buildTemplateSendPayload = (args) => ({
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
const buildParamsFromContact = (contact, varCount) => {
    const fallback = [
        contact?.firstName || '',
        contact?.lastName || '',
        contact?.phone || '',
        contact?.email || '',
    ].filter(Boolean);
    const params = [];
    for (let i = 0; i < varCount; i++) {
        params.push(fallback[i] || 'NA');
    }
    return params;
};
const calculateRates = (campaign) => {
    const deliveryRate = campaign.sentCount > 0 ? Math.round((campaign.deliveredCount / campaign.sentCount) * 100) : 0;
    const readRate = campaign.deliveredCount > 0
        ? Math.round((campaign.readCount / campaign.deliveredCount) * 100)
        : 0;
    return { deliveryRate, readRate };
};
const formatCampaign = (campaign) => {
    const { deliveryRate, readRate } = calculateRates(campaign);
    const pendingCount = campaign.totalContacts - campaign.sentCount - campaign.failedCount;
    return {
        id: campaign.id,
        name: campaign.name,
        description: campaign.description,
        templateId: campaign.templateId,
        templateName: campaign.template?.name || campaign.Template?.name || '',
        whatsappAccountId: campaign.whatsappAccountId,
        whatsappAccountPhone: campaign.whatsappAccount?.phoneNumber ||
            campaign.WhatsAppAccount?.phoneNumber ||
            '',
        contactGroupId: campaign.contactGroupId,
        contactGroupName: campaign.contactGroup?.name || campaign.ContactGroup?.name || null,
        audienceFilter: campaign.audienceFilter,
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
const formatCampaignContact = (cc) => ({
    id: cc.id,
    contactId: cc.contactId,
    phone: cc.contact?.phone || cc.Contact?.phone || '',
    fullName: [
        cc.contact?.firstName || cc.Contact?.firstName,
        cc.contact?.lastName || cc.Contact?.lastName,
    ]
        .filter(Boolean)
        .join(' ') ||
        cc.contact?.phone ||
        cc.Contact?.phone ||
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
const toJsonValue = (value) => {
    if (value === undefined || value === null)
        return undefined;
    return JSON.parse(JSON.stringify(value));
};
// ============================================
// CAMPAIGNS SERVICE CLASS
// ============================================
class CampaignsService {
    // ==========================================
    // FIND WHATSAPP ACCOUNT (ROBUST)
    // ==========================================
    async findWhatsAppAccount(organizationId, whatsappAccountId, phoneNumberId) {
        console.log('🔍 Finding WhatsApp account:', {
            organizationId,
            whatsappAccountId,
            phoneNumberId,
        });
        let waAccount = null;
        if (whatsappAccountId) {
            waAccount = await database_1.default.whatsAppAccount.findFirst({
                where: {
                    id: whatsappAccountId,
                    organizationId,
                },
            });
            if (waAccount)
                return waAccount;
        }
        if (!waAccount && phoneNumberId) {
            waAccount = await database_1.default.whatsAppAccount.findFirst({
                where: {
                    phoneNumberId,
                    organizationId,
                },
            });
            if (waAccount)
                return waAccount;
        }
        if (!waAccount) {
            waAccount = await database_1.default.whatsAppAccount.findFirst({
                where: {
                    organizationId,
                    status: 'CONNECTED',
                },
                orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
            });
            if (waAccount)
                return waAccount;
        }
        if (!waAccount) {
            waAccount = await database_1.default.whatsAppAccount.findFirst({
                where: { organizationId },
                orderBy: { createdAt: 'desc' },
            });
            if (waAccount)
                return waAccount;
        }
        return null;
    }
    // ==========================================
    // CREATE CAMPAIGN
    // ==========================================
    async create(organizationId, userId, input) {
        const { name, description, templateId, whatsappAccountId, phoneNumberId, contactGroupId, contactIds, audienceFilter, scheduledAt, } = input;
        console.log('📦 Campaign create request:', {
            organizationId,
            name,
            templateId,
            whatsappAccountId,
            phoneNumberId,
            contactIdsCount: contactIds?.length || 0,
        });
        const template = await database_1.default.template.findFirst({
            where: { id: templateId, organizationId },
        });
        if (!template) {
            throw new errorHandler_1.AppError('Template not found', 404);
        }
        if (template.status !== 'APPROVED') {
            throw new errorHandler_1.AppError(`Template is not approved yet (status: ${template.status}). Please wait for Meta approval.`, 400);
        }
        if (!template.metaTemplateId) {
            throw new errorHandler_1.AppError('Template is not synced from Meta. Please sync templates first.', 400);
        }
        const waAccount = await this.findWhatsAppAccount(organizationId, whatsappAccountId, phoneNumberId);
        if (!waAccount) {
            throw new errorHandler_1.AppError('WhatsApp account not found. Please connect WhatsApp first in Settings → WhatsApp.', 400);
        }
        if (template.wabaId && waAccount?.wabaId && template.wabaId !== waAccount.wabaId) {
            throw new errorHandler_1.AppError('Selected template belongs to a different WABA. Please select a template for the connected number.', 400);
        }
        if (contactGroupId) {
            const group = await database_1.default.contactGroup.findFirst({
                where: { id: contactGroupId, organizationId },
            });
            if (!group) {
                throw new errorHandler_1.AppError('Contact group not found', 404);
            }
        }
        let targetContacts = [];
        if (contactIds && contactIds.length > 0) {
            targetContacts = await database_1.default.contact.findMany({
                where: {
                    id: { in: contactIds },
                    organizationId,
                    status: 'ACTIVE',
                },
                select: { id: true },
            });
        }
        else if (contactGroupId) {
            const groupMembers = await database_1.default.contactGroupMember.findMany({
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
        }
        else if (audienceFilter) {
            const where = {
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
                    ...where.createdAt,
                    lte: new Date(audienceFilter.createdBefore),
                };
            }
            if (audienceFilter.hasMessaged !== undefined) {
                where.messageCount = audienceFilter.hasMessaged ? { gt: 0 } : { equals: 0 };
            }
            targetContacts = await database_1.default.contact.findMany({
                where,
                select: { id: true },
            });
        }
        if (targetContacts.length === 0) {
            throw new errorHandler_1.AppError('No contacts found for this campaign', 400);
        }
        const campaign = await database_1.default.$transaction(async (tx) => {
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
                },
                include: {
                    template: { select: { name: true } },
                    whatsappAccount: { select: { phoneNumber: true } },
                    contactGroup: { select: { name: true } },
                },
            });
            const campaignContactsData = targetContacts.map((contact) => ({
                id: (0, uuid_1.v4)(),
                campaignId: newCampaign.id,
                contactId: contact.id,
                status: 'PENDING',
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
        campaigns_socket_1.campaignSocketService.emitCampaignUpdate(organizationId, campaign.id, {
            status: campaign.status,
            message: 'Campaign created successfully',
            totalContacts: targetContacts.length,
        });
        return formatCampaign(campaign);
    }
    // ==========================================
    // GET CAMPAIGNS LIST
    // ==========================================
    async getList(organizationId, query) {
        const { page = 1, limit = 20, search, status, sortBy = 'createdAt', sortOrder = 'desc', } = query;
        const skip = (page - 1) * limit;
        const where = {
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
            database_1.default.campaign.findMany({
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
            database_1.default.campaign.count({ where }),
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
    async getById(organizationId, campaignId) {
        const campaign = await database_1.default.campaign.findFirst({
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
            },
        });
        if (!campaign) {
            throw new errorHandler_1.AppError('Campaign not found', 404);
        }
        const c = campaign;
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
    async update(organizationId, campaignId, input) {
        const campaign = await database_1.default.campaign.findFirst({
            where: {
                id: campaignId,
                organizationId,
            },
        });
        if (!campaign) {
            throw new errorHandler_1.AppError('Campaign not found', 404);
        }
        if (['RUNNING', 'COMPLETED'].includes(campaign.status)) {
            throw new errorHandler_1.AppError(`Cannot update ${campaign.status.toLowerCase()} campaign`, 400);
        }
        if (input.templateId) {
            const template = await database_1.default.template.findFirst({
                where: {
                    id: input.templateId,
                    organizationId,
                },
            });
            if (!template) {
                throw new errorHandler_1.AppError('Template not found', 404);
            }
        }
        const updated = await database_1.default.campaign.update({
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
        // ✅ Emit campaign updated event
        campaigns_socket_1.campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
            status: updated.status,
            message: 'Campaign updated successfully',
        });
        return formatCampaign(updated);
    }
    // ==========================================
    // DELETE CAMPAIGN
    // ==========================================
    async delete(organizationId, campaignId) {
        const campaign = await database_1.default.campaign.findFirst({
            where: {
                id: campaignId,
                organizationId,
            },
        });
        if (!campaign) {
            throw new errorHandler_1.AppError('Campaign not found', 404);
        }
        if (campaign.status === 'RUNNING') {
            throw new errorHandler_1.AppError('Cannot delete running campaign. Pause or cancel it first.', 400);
        }
        await database_1.default.campaign.delete({
            where: { id: campaignId },
        });
        console.log(`✅ Campaign deleted: ${campaignId}`);
        // ✅ Emit campaign deleted event
        campaigns_socket_1.campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
            status: 'DELETED',
            message: 'Campaign deleted successfully',
        });
        return { message: 'Campaign deleted successfully' };
    }
    // ==========================================
    // START CAMPAIGN - ✅ WITH ROBUST CHECKS
    // ==========================================
    async start(organizationId, campaignId) {
        console.log('🚀 Starting campaign:', { id: campaignId, organizationId });
        const campaign = await database_1.default.campaign.findFirst({
            where: { id: campaignId, organizationId },
            include: {
                template: true,
                whatsappAccount: true,
            },
        });
        if (!campaign) {
            throw new errorHandler_1.AppError('Campaign not found', 404);
        }
        if (campaign.status === 'RUNNING') {
            throw new errorHandler_1.AppError('Campaign is already running', 400);
        }
        if (!campaign.whatsappAccountId) {
            throw new errorHandler_1.AppError('No WhatsApp account connected to this campaign', 400);
        }
        if (!campaign.templateId) {
            throw new errorHandler_1.AppError('No template selected for this campaign', 400);
        }
        // ✅ CRITICAL: Check if campaign has contacts
        const contactCount = await database_1.default.campaignContact.count({
            where: { campaignId },
        });
        console.log(`📊 Campaign has ${contactCount} contacts`);
        if (contactCount === 0) {
            throw new errorHandler_1.AppError('Campaign has no contacts. Please add contacts first.', 400);
        }
        // ✅ Check pending contacts
        const pendingCount = await database_1.default.campaignContact.count({
            where: {
                campaignId,
                status: 'PENDING',
            },
        });
        console.log(`📋 Pending contacts: ${pendingCount}`);
        if (pendingCount === 0) {
            throw new errorHandler_1.AppError('No pending contacts to send. All contacts may have been processed.', 400);
        }
        // Update campaign status
        const updatedCampaign = await database_1.default.campaign.update({
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
        console.log('✅ Campaign status updated to RUNNING');
        // ✅ Emit campaign started event
        campaigns_socket_1.campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
            status: 'RUNNING',
            message: 'Campaign started successfully',
            totalContacts: contactCount,
        });
        // ✅ CRITICAL: Start processing contacts
        console.log('🔄 Starting contact processing...');
        this.processCampaignContacts(campaignId, organizationId).catch((error) => {
            console.error('❌ Campaign processing error:', error);
        });
        return formatCampaign(updatedCampaign);
    }
    // ✅ PROCESS CAMPAIGN CONTACTS
    async processCampaignContacts(campaignId, organizationId) {
        console.log(`📤 Processing contacts for campaign: ${campaignId}`);
        const campaign = await database_1.default.campaign.findUnique({
            where: { id: campaignId },
            include: {
                template: true,
                whatsappAccount: true,
            },
        });
        if (!campaign) {
            console.error('❌ Campaign not found');
            return;
        }
        // ✅ Get pending contacts in batches
        const BATCH_SIZE = 100;
        let processedCount = 0;
        let hasMore = true;
        while (hasMore) {
            // Check if campaign is still running
            const currentCampaign = await database_1.default.campaign.findUnique({
                where: { id: campaignId },
                select: { status: true },
            });
            if (currentCampaign?.status !== 'RUNNING') {
                console.log('⏸️ Campaign stopped, halting processing');
                break;
            }
            // Get batch of pending contacts
            const contacts = await database_1.default.campaignContact.findMany({
                where: {
                    campaignId,
                    status: 'PENDING',
                },
                include: {
                    contact: true,
                },
                take: BATCH_SIZE,
                orderBy: { createdAt: 'asc' },
            });
            console.log(`📦 Processing batch of ${contacts.length} contacts`);
            if (contacts.length === 0) {
                hasMore = false;
                break;
            }
            // Process each contact
            for (const campaignContact of contacts) {
                try {
                    const contact = campaignContact.contact;
                    const phone = contact?.phone;
                    if (!phone) {
                        console.warn(`⚠️ Skipping contact ${campaignContact.id} - no phone`);
                        continue;
                    }
                    console.log(`📞 Processing contact: ${phone}`);
                    // ✅ Add to message queue
                    await (0, messageQueue_service_1.addMessage)({
                        campaignId,
                        campaignContactId: campaignContact.id,
                        contactId: campaignContact.contactId,
                        phone,
                        templateId: campaign.templateId,
                        whatsappAccountId: campaign.whatsappAccountId,
                        organizationId: campaign.organizationId,
                        variables: campaignContact.variables || {},
                    });
                    processedCount++;
                    // Emit individual progress if needed (optional, could be noisy)
                    // campaignSocketService.emitContactStatus(...)
                }
                catch (error) {
                    console.error(`❌ Failed to queue contact ${campaignContact.id}:`, error.message);
                    // Mark as failed
                    await database_1.default.campaignContact.update({
                        where: { id: campaignContact.id },
                        data: {
                            status: 'FAILED',
                            failureReason: error.message,
                            failedAt: new Date(),
                        },
                    });
                }
            }
            // ✅ Emit batch progress
            const totalProcessed = await database_1.default.campaignContact.count({
                where: { campaignId, status: { not: 'PENDING' } }
            });
            campaigns_socket_1.campaignSocketService.emitCampaignProgress(organizationId, campaignId, {
                sent: totalProcessed, // This includes Sent + Failed. Adjust if you only want SENT
                failed: 0, // Will be updated by queue
                total: campaign.totalContacts,
                percentage: Math.round((totalProcessed / campaign.totalContacts) * 100),
                status: 'RUNNING'
            });
            // ✅ Delay between batches (avoid rate limits)
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        console.log(`✅ Campaign processing complete: ${processedCount} contacts queued`);
        // ✅ Update campaign stats
        await this.updateCampaignStats(campaignId);
    }
    // ✅ UPDATE CAMPAIGN STATS
    async updateCampaignStats(campaignId) {
        const stats = await database_1.default.campaignContact.groupBy({
            by: ['status'],
            where: { campaignId },
            _count: true,
        });
        const statusCounts = {};
        stats.forEach((stat) => {
            statusCounts[stat.status] = stat._count;
        });
        await database_1.default.campaign.update({
            where: { id: campaignId },
            data: {
                totalContacts: Object.values(statusCounts).reduce((a, b) => a + b, 0),
                sentCount: statusCounts.SENT || 0,
                deliveredCount: statusCounts.DELIVERED || 0,
                readCount: statusCounts.READ || 0,
                failedCount: statusCounts.FAILED || 0,
            },
        });
        console.log('📊 Campaign stats updated:', statusCounts);
        // Check if finished
        const pendingCount = await database_1.default.campaignContact.count({
            where: { campaignId, status: 'PENDING' }
        });
        if (pendingCount === 0) {
            await database_1.default.campaign.update({
                where: { id: campaignId },
                data: {
                    status: 'COMPLETED',
                    completedAt: new Date()
                }
            });
            console.log(`🏁 Campaign ${campaignId} marked as COMPLETED`);
        }
    }
    // ==========================================
    // PAUSE/RESUME/CANCEL
    // ==========================================
    async pause(organizationId, campaignId) {
        const campaign = await database_1.default.campaign.findFirst({
            where: { id: campaignId, organizationId },
        });
        if (!campaign) {
            throw new errorHandler_1.AppError('Campaign not found', 404);
        }
        if (campaign.status !== 'RUNNING') {
            throw new errorHandler_1.AppError('Only running campaigns can be paused', 400);
        }
        const updated = await database_1.default.campaign.update({
            where: { id: campaignId },
            data: { status: 'PAUSED' },
            include: {
                template: { select: { name: true } },
                whatsappAccount: { select: { phoneNumber: true } },
                contactGroup: { select: { name: true } },
            },
        });
        console.log(`⏸️ Campaign paused: ${campaignId}`);
        // ✅ Emit campaign paused event
        campaigns_socket_1.campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
            status: 'PAUSED',
            message: 'Campaign paused',
        });
        return formatCampaign(updated);
    }
    async resume(organizationId, campaignId) {
        const campaign = await database_1.default.campaign.findFirst({
            where: { id: campaignId, organizationId },
        });
        if (!campaign) {
            throw new errorHandler_1.AppError('Campaign not found', 404);
        }
        if (campaign.status !== 'PAUSED') {
            throw new errorHandler_1.AppError('Only paused campaigns can be resumed', 400);
        }
        const accountData = await meta_service_1.metaService.getAccountWithToken(campaign.whatsappAccountId);
        if (!accountData || !accountData.accessToken.startsWith('EAA')) {
            throw new errorHandler_1.AppError('WhatsApp account token is invalid. Please reconnect before resuming.', 400);
        }
        const updated = await database_1.default.campaign.update({
            where: { id: campaignId },
            data: { status: 'RUNNING' },
            include: {
                template: { select: { name: true } },
                whatsappAccount: { select: { phoneNumber: true } },
                contactGroup: { select: { name: true } },
            },
        });
        console.log(`▶️ Campaign resumed: ${campaignId}`);
        // ✅ Emit campaign resumed event
        campaigns_socket_1.campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
            status: 'RUNNING',
            message: 'Campaign resumed',
        });
        // Resume sending
        this.processCampaignContacts(campaignId, organizationId);
        return formatCampaign(updated);
    }
    async cancel(organizationId, campaignId) {
        const campaign = await database_1.default.campaign.findFirst({
            where: { id: campaignId, organizationId },
        });
        if (!campaign) {
            throw new errorHandler_1.AppError('Campaign not found', 404);
        }
        if (['COMPLETED', 'FAILED'].includes(campaign.status)) {
            throw new errorHandler_1.AppError('Campaign is already finished', 400);
        }
        const updated = await database_1.default.campaign.update({
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
        console.log(`❌ Campaign cancelled: ${campaignId}`);
        // ✅ Emit campaign cancelled event
        campaigns_socket_1.campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
            status: 'FAILED',
            message: 'Campaign cancelled by user',
        });
        return formatCampaign(updated);
    }
    // ==========================================
    // GET CAMPAIGN CONTACTS
    // ==========================================
    async getContacts(organizationId, campaignId, query) {
        const { page = 1, limit = 50, status } = query;
        const skip = (page - 1) * limit;
        const campaign = await database_1.default.campaign.findFirst({
            where: { id: campaignId, organizationId },
        });
        if (!campaign) {
            throw new errorHandler_1.AppError('Campaign not found', 404);
        }
        const where = {
            campaignId,
        };
        if (status) {
            where.status = status;
        }
        const [contacts, total] = await Promise.all([
            database_1.default.campaignContact.findMany({
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
                },
            }),
            database_1.default.campaignContact.count({ where }),
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
    async retry(organizationId, campaignId, retryFailed = true, retryPending = false) {
        const campaign = await database_1.default.campaign.findFirst({
            where: { id: campaignId, organizationId },
        });
        if (!campaign) {
            throw new errorHandler_1.AppError('Campaign not found', 404);
        }
        const accountData = await meta_service_1.metaService.getAccountWithToken(campaign.whatsappAccountId);
        if (!accountData || !accountData.accessToken.startsWith('EAA')) {
            throw new errorHandler_1.AppError('WhatsApp account token is invalid. Please reconnect before retrying.', 400);
        }
        const statusesToRetry = [];
        if (retryFailed)
            statusesToRetry.push('FAILED');
        if (retryPending)
            statusesToRetry.push('PENDING');
        if (statusesToRetry.length === 0) {
            throw new errorHandler_1.AppError('No retry options selected', 400);
        }
        const result = await database_1.default.campaignContact.updateMany({
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
            await database_1.default.campaign.update({
                where: { id: campaignId },
                data: { status: 'RUNNING' },
            });
            // ✅ Emit retry started event
            campaigns_socket_1.campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
                status: 'RUNNING',
                message: `Retrying ${result.count} messages`,
            });
            // Resume sending
            this.processCampaignContacts(campaignId, organizationId);
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
    async duplicate(organizationId, campaignId, newName) {
        const original = await database_1.default.campaign.findFirst({
            where: { id: campaignId, organizationId },
        });
        if (!original) {
            throw new errorHandler_1.AppError('Campaign not found', 404);
        }
        const originalContacts = await database_1.default.campaignContact.findMany({
            where: { campaignId },
            select: { contactId: true },
        });
        const duplicate = await database_1.default.$transaction(async (tx) => {
            const newCampaign = await tx.campaign.create({
                data: {
                    organizationId,
                    name: newName,
                    description: original.description,
                    templateId: original.templateId,
                    whatsappAccountId: original.whatsappAccountId,
                    contactGroupId: original.contactGroupId,
                    audienceFilter: original.audienceFilter === null ? undefined : toJsonValue(original.audienceFilter),
                    status: 'DRAFT',
                    totalContacts: originalContacts.length,
                    createdById: original.createdById,
                },
                include: {
                    template: { select: { name: true } },
                    whatsappAccount: { select: { phoneNumber: true } },
                    contactGroup: { select: { name: true } },
                },
            });
            if (originalContacts.length > 0) {
                await tx.campaignContact.createMany({
                    data: originalContacts.map((c) => ({
                        id: (0, uuid_1.v4)(),
                        campaignId: newCampaign.id,
                        contactId: c.contactId,
                        status: 'PENDING',
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    })),
                });
            }
            return newCampaign;
        });
        console.log(`📋 Campaign duplicated: ${campaignId} → ${duplicate.id}`);
        // ✅ Emit duplicate created event
        campaigns_socket_1.campaignSocketService.emitCampaignUpdate(organizationId, duplicate.id, {
            status: 'DRAFT',
            message: 'Campaign duplicated successfully',
            totalContacts: originalContacts.length,
        });
        return formatCampaign(duplicate);
    }
    async shouldStopCampaign(campaignId) {
        const currentCampaign = await database_1.default.campaign.findUnique({
            where: { id: campaignId },
            select: { status: true },
        });
        return !currentCampaign || currentCampaign.status !== 'RUNNING';
    }
    async saveCampaignMessage(organizationId, campaignId, contactId, accountId, waMessageId, templateName, templateLang, params, templateId, campaignName) {
        try {
            let conversation = await database_1.default.conversation.findFirst({
                where: {
                    organizationId,
                    contactId,
                },
            });
            const now = new Date();
            const windowExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            if (!conversation) {
                conversation = await database_1.default.conversation.create({
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
            }
            else {
                await database_1.default.conversation.update({
                    where: { id: conversation.id },
                    data: {
                        lastMessageAt: now,
                        lastMessagePreview: `Template: ${templateName}`,
                        windowExpiresAt: windowExpiry,
                        isWindowOpen: true,
                    },
                });
            }
            await database_1.default.message.create({
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
        }
        catch (saveErr) {
            console.error('⚠️ Failed to save campaign message:', saveErr.message);
        }
    }
    // ==========================================
    // GET CAMPAIGN STATS
    // ==========================================
    async getStats(organizationId) {
        try {
            const stats = await database_1.default.campaign.aggregate({
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
            const statusCounts = await database_1.default.campaign.groupBy({
                by: ['status'],
                where: { organizationId },
                _count: true,
            });
            const total = stats._count.id || 0;
            const totalSent = stats._sum.sentCount || 0;
            const totalDelivered = stats._sum.deliveredCount || 0;
            const totalRead = stats._sum.readCount || 0;
            const getStatusCount = (status) => statusCounts.find((s) => s.status === status)?._count || 0;
            const deliveryRate = totalSent > 0 ? Number(((totalDelivered / totalSent) * 100).toFixed(1)) : 0;
            const readRate = totalDelivered > 0 ? Number(((totalRead / totalDelivered) * 100).toFixed(1)) : 0;
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
        }
        catch (error) {
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
            throw new errorHandler_1.AppError('Failed to fetch campaign statistics', 500);
        }
    }
    // ==========================================
    // GET CAMPAIGN ANALYTICS
    // ==========================================
    async getAnalytics(organizationId, campaignId) {
        const campaign = await database_1.default.campaign.findFirst({
            where: { id: campaignId, organizationId },
        });
        if (!campaign) {
            throw new errorHandler_1.AppError('Campaign not found', 404);
        }
        const statusCounts = await database_1.default.campaignContact.groupBy({
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
    async updateContactStatus(organizationId, campaignId, contactId, status, waMessageId, failureReason) {
        const now = new Date();
        const updateData = {
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
        await database_1.default.campaignContact.updateMany({
            where: {
                campaignId,
                contactId,
            },
            data: updateData,
        });
        const countField = `${status.toLowerCase()}Count`;
        if (['SENT', 'DELIVERED', 'READ', 'FAILED'].includes(status)) {
            await database_1.default.campaign.update({
                where: { id: campaignId },
                data: {
                    [countField]: { increment: 1 },
                },
            });
        }
        // ✅ Emit status update via socket
        const contact = await database_1.default.contact.findUnique({
            where: { id: contactId },
            select: { phone: true },
        });
        if (contact) {
            campaigns_socket_1.campaignSocketService.emitContactStatus(organizationId, campaignId, {
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
    async checkAndComplete(organizationId, campaignId) {
        const campaign = await database_1.default.campaign.findUnique({
            where: { id: campaignId },
        });
        if (!campaign || campaign.status !== 'RUNNING')
            return;
        const pendingCount = await database_1.default.campaignContact.count({
            where: {
                campaignId,
                status: 'PENDING',
            },
        });
        if (pendingCount === 0) {
            const updated = await database_1.default.campaign.update({
                where: { id: campaignId },
                data: {
                    status: 'COMPLETED',
                    completedAt: new Date(),
                },
            });
            console.log(`✅ Campaign completed: ${campaignId}`);
            // ✅ Emit campaign completed event
            campaigns_socket_1.campaignSocketService.emitCampaignCompleted(organizationId, campaignId, {
                sentCount: updated.sentCount,
                failedCount: updated.failedCount,
                deliveredCount: updated.deliveredCount,
                readCount: updated.readCount,
                totalRecipients: updated.totalContacts,
            });
        }
    }
}
exports.CampaignsService = CampaignsService;
exports.campaignsService = new CampaignsService();
//# sourceMappingURL=campaigns.service.js.map