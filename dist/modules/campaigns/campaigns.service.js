"use strict";
// 📁 src/modules/campaigns/campaigns.service.ts - COMPLETE WITH ALL FIXES + SOCKET INTEGRATION
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.campaignsService = exports.CampaignsService = void 0;
const errorHandler_1 = require("../../middleware/errorHandler");
const whatsapp_api_1 = require("../whatsapp/whatsapp.api");
const meta_service_1 = require("../meta/meta.service");
const campaigns_socket_1 = require("./campaigns.socket"); // ✅ Added
const uuid_1 = require("uuid");
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
    // START CAMPAIGN - ✅ WITH SOCKET UPDATES
    // ==========================================
    async start(organizationId, campaignId) {
        const campaign = await database_1.default.campaign.findFirst({
            where: { id: campaignId, organizationId },
            include: { template: true, whatsappAccount: true },
        });
        if (!campaign) {
            throw new errorHandler_1.AppError('Campaign not found', 404);
        }
        if (!['DRAFT', 'SCHEDULED', 'PAUSED'].includes(campaign.status)) {
            throw new errorHandler_1.AppError(`Cannot start campaign with status: ${campaign.status}`, 400);
        }
        if (!campaign.whatsappAccount) {
            throw new errorHandler_1.AppError('WhatsApp account not found for this campaign', 400);
        }
        if (campaign.whatsappAccount.status !== 'CONNECTED') {
            throw new errorHandler_1.AppError('WhatsApp account is not connected', 400);
        }
        const accountData = await meta_service_1.metaService.getAccountWithToken(campaign.whatsappAccountId);
        if (!accountData) {
            throw new errorHandler_1.AppError('WhatsApp account token is invalid or unavailable. Please reconnect in Settings → WhatsApp.', 400);
        }
        if (!accountData.accessToken.startsWith('EAA')) {
            throw new errorHandler_1.AppError('WhatsApp account token is corrupted. Please reconnect in Settings → WhatsApp.', 400);
        }
        console.log(`✅ Token validated for campaign: ${campaignId}`);
        const updated = await database_1.default.campaign.update({
            where: { id: campaignId },
            data: {
                status: 'RUNNING',
                startedAt: campaign.startedAt || new Date(),
            },
            include: {
                template: { select: { name: true, language: true, variables: true } },
                whatsappAccount: { select: { id: true, phoneNumber: true } },
                contactGroup: { select: { name: true } },
            },
        });
        console.log(`🚀 Starting campaign: ${campaignId}`);
        // ✅ Emit campaign started event
        campaigns_socket_1.campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
            status: 'RUNNING',
            message: 'Campaign started successfully',
            totalContacts: updated.totalContacts,
        });
        // Fire-and-forget sending
        void this.processCampaignSending(organizationId, campaignId).catch((e) => {
            console.error('❌ Campaign send process failed:', e);
            // ✅ Emit error event
            campaigns_socket_1.campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
                status: 'FAILED',
                message: `Campaign failed: ${e.message}`,
            });
        });
        return formatCampaign(updated);
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
        void this.processCampaignSending(organizationId, campaignId).catch((e) => {
            console.error('❌ Campaign resume send failed:', e);
            campaigns_socket_1.campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
                status: 'FAILED',
                message: `Campaign failed: ${e.message}`,
            });
        });
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
            void this.processCampaignSending(organizationId, campaignId).catch((e) => {
                console.error('❌ Campaign retry send failed:', e);
                campaigns_socket_1.campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
                    status: 'FAILED',
                    message: `Retry failed: ${e.message}`,
                });
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
    // ==========================================
    // PROCESS CAMPAIGN SENDING - ✅ WITH SOCKET UPDATES
    // ==========================================
    async processCampaignSending(organizationId, campaignId) {
        console.log(`📤 Starting send process for campaign: ${campaignId}`);
        const campaign = await database_1.default.campaign.findFirst({
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
        const accountData = await meta_service_1.metaService.getAccountWithToken(campaign.whatsappAccountId);
        if (!accountData) {
            console.error('❌ WhatsApp account not found or token unavailable');
            await database_1.default.campaign.update({
                where: { id: campaignId },
                data: {
                    status: 'FAILED',
                    completedAt: new Date(),
                },
            });
            campaigns_socket_1.campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
                status: 'FAILED',
                message: 'WhatsApp account token unavailable',
            });
            return;
        }
        const { account, accessToken } = accountData;
        if (!accessToken.startsWith('EAA')) {
            console.error('❌ Invalid access token format');
            await database_1.default.campaign.update({
                where: { id: campaignId },
                data: {
                    status: 'FAILED',
                    completedAt: new Date(),
                },
            });
            campaigns_socket_1.campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
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
            await database_1.default.campaign.update({
                where: { id: campaignId },
                data: {
                    status: 'FAILED',
                    completedAt: new Date(),
                },
            });
            campaigns_socket_1.campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
                status: 'FAILED',
                message: 'Template missing',
            });
            return;
        }
        const vars = template.variables || [];
        const varCount = Array.isArray(vars) ? vars.length : 0;
        // ✅ Get total contacts count for progress tracking
        const totalContacts = await database_1.default.campaignContact.count({
            where: { campaignId },
        });
        let batchCount = 0;
        const MAX_BATCHES = 100;
        let totalSent = 0;
        let totalFailed = 0;
        // ✅ Emit initial progress
        campaigns_socket_1.campaignSocketService.emitCampaignProgress(organizationId, campaignId, {
            sent: 0,
            failed: 0,
            total: totalContacts,
            percentage: 0,
            status: 'RUNNING',
        });
        while (batchCount < MAX_BATCHES) {
            batchCount++;
            const currentCampaign = await database_1.default.campaign.findUnique({
                where: { id: campaignId },
                select: { status: true },
            });
            if (!currentCampaign || currentCampaign.status !== 'RUNNING') {
                console.log(`⚠️ Campaign stopped at batch ${batchCount}`);
                break;
            }
            const pending = await database_1.default.campaignContact.findMany({
                where: { campaignId, status: 'PENDING' },
                take: 25,
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
                },
            });
            if (!pending.length) {
                console.log(`✅ No more pending contacts`);
                break;
            }
            console.log(`📤 Processing batch ${batchCount}: ${pending.length} contacts`);
            for (const cc of pending) {
                const c = cc.contact || cc.Contact;
                const to = toRecipient(c);
                if (!to || to.length < 10) {
                    await this.updateContactStatus(organizationId, campaignId, cc.contactId, 'FAILED', undefined, 'Contact phone missing, empty, or invalid format');
                    totalFailed++;
                    // ✅ Emit contact failed event
                    campaigns_socket_1.campaignSocketService.emitContactStatus(organizationId, campaignId, {
                        contactId: cc.contactId,
                        phone: c?.phone || 'unknown',
                        status: 'FAILED',
                        error: 'Invalid phone number',
                    });
                    continue;
                }
                const toDigits = digitsOnly(to);
                const fromDigits = digitsOnly(account.phoneNumber);
                if (toDigits && fromDigits && toDigits === fromDigits) {
                    console.warn(`⚠️ Skipping self-send to ${to}`);
                    await this.updateContactStatus(organizationId, campaignId, cc.contactId, 'FAILED', undefined, 'Cannot send to business number (sender = recipient)');
                    totalFailed++;
                    campaigns_socket_1.campaignSocketService.emitContactStatus(organizationId, campaignId, {
                        contactId: cc.contactId,
                        phone: to,
                        status: 'FAILED',
                        error: 'Cannot send to business number',
                    });
                    continue;
                }
                try {
                    const params = buildParamsFromContact(c, varCount);
                    const payload = buildTemplateSendPayload({
                        to,
                        templateName,
                        language: templateLang,
                        params,
                    });
                    console.log(`📤 Sending to ${to} with template ${templateName} (${templateLang})`);
                    const res = await whatsapp_api_1.whatsappApi.sendMessage(account.phoneNumberId, accessToken, payload);
                    const waMessageId = res?.messages?.[0]?.id;
                    if (!waMessageId) {
                        throw new Error('No message ID returned from WhatsApp API');
                    }
                    await this.updateContactStatus(organizationId, campaignId, cc.contactId, 'SENT', waMessageId);
                    // Save message with conversation
                    try {
                        let conversation = await database_1.default.conversation.findFirst({
                            where: {
                                organizationId,
                                contactId: c.id,
                            },
                        });
                        const now = new Date();
                        const windowExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000);
                        if (!conversation) {
                            conversation = await database_1.default.conversation.create({
                                data: {
                                    organizationId,
                                    contactId: c.id,
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
                                whatsappAccountId: account.id,
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
                                templateId: template.id,
                                sentAt: now,
                                metadata: {
                                    campaignId,
                                    campaignName: campaign.name,
                                },
                            },
                        });
                        console.log(`💾 Campaign message saved with conversation: ${waMessageId}`);
                    }
                    catch (saveErr) {
                        console.error('⚠️ Failed to save campaign message:', saveErr.message);
                    }
                    totalSent++;
                    console.log(`✅ Message sent to ${to} (${waMessageId})`);
                    // ✅ Emit contact success event
                    campaigns_socket_1.campaignSocketService.emitContactStatus(organizationId, campaignId, {
                        contactId: cc.contactId,
                        phone: to,
                        status: 'SENT',
                        messageId: waMessageId,
                    });
                    // ✅ Emit progress update
                    const percentage = Math.round(((totalSent + totalFailed) / totalContacts) * 100);
                    campaigns_socket_1.campaignSocketService.emitCampaignProgress(organizationId, campaignId, {
                        sent: totalSent,
                        failed: totalFailed,
                        total: totalContacts,
                        percentage,
                        status: 'RUNNING',
                    });
                    await new Promise((r) => setTimeout(r, 80));
                }
                catch (e) {
                    const metaErr = e?.response?.data?.error;
                    console.error(`❌ Failed to send to ${to}:`, {
                        code: metaErr?.code,
                        message: metaErr?.message,
                        error_subcode: metaErr?.error_subcode,
                        error_data: metaErr?.error_data,
                        fbtrace_id: metaErr?.fbtrace_id,
                    });
                    if (metaErr?.code === 190) {
                        console.error('❌ OAuth token invalid - stopping campaign');
                        await database_1.default.whatsAppAccount.update({
                            where: { id: account.id },
                            data: {
                                status: 'DISCONNECTED',
                                accessToken: null,
                                tokenExpiresAt: null,
                            },
                        });
                        await database_1.default.campaign.update({
                            where: { id: campaignId },
                            data: {
                                status: 'FAILED',
                                completedAt: new Date(),
                            },
                        });
                        campaigns_socket_1.campaignSocketService.emitCampaignUpdate(organizationId, campaignId, {
                            status: 'FAILED',
                            message: 'OAuth token invalid - account disconnected',
                        });
                        return;
                    }
                    if (metaErr?.code === 130429) {
                        console.warn('⚠️ Rate limit hit, waiting 60 seconds...');
                        await new Promise((r) => setTimeout(r, 60000));
                    }
                    const reason = metaErr?.message || e?.message || 'Send failed';
                    await this.updateContactStatus(organizationId, campaignId, cc.contactId, 'FAILED', undefined, reason);
                    totalFailed++;
                    // ✅ Emit contact failed event
                    campaigns_socket_1.campaignSocketService.emitContactStatus(organizationId, campaignId, {
                        contactId: cc.contactId,
                        phone: to,
                        status: 'FAILED',
                        error: reason,
                    });
                    // ✅ Emit progress update
                    const percentage = Math.round(((totalSent + totalFailed) / totalContacts) * 100);
                    campaigns_socket_1.campaignSocketService.emitCampaignProgress(organizationId, campaignId, {
                        sent: totalSent,
                        failed: totalFailed,
                        total: totalContacts,
                        percentage,
                        status: 'RUNNING',
                    });
                }
            }
        }
        console.log(`📊 Campaign ${campaignId} send process completed. Sent: ${totalSent}, Failed: ${totalFailed}`);
        await this.checkAndComplete(organizationId, campaignId);
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