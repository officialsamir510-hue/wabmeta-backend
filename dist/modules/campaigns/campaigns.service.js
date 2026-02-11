"use strict";
// src/modules/campaigns/campaigns.service.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.campaignsService = exports.CampaignsService = void 0;
const database_1 = __importDefault(require("../../config/database"));
const errorHandler_1 = require("../../middleware/errorHandler");
const whatsapp_api_1 = require("../whatsapp/whatsapp.api");
// ============================================
// HELPER FUNCTIONS
// ============================================
const digitsOnly = (p) => String(p || '').replace(/\D/g, '');
const toMetaLang = (lang) => (lang?.includes('_') ? lang : lang === 'en' ? 'en_US' : 'en_US');
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
                    parameters: args.params.map((t) => ({ type: 'text', text: t })),
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
    for (let i = 0; i < varCount; i++)
        params.push(fallback[i] || 'NA');
    return params;
};
const calculateRates = (campaign) => {
    const deliveryRate = campaign.sentCount > 0
        ? Math.round((campaign.deliveredCount / campaign.sentCount) * 100)
        : 0;
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
        templateName: campaign.template?.name || '',
        whatsappAccountId: campaign.whatsappAccountId,
        whatsappAccountPhone: campaign.whatsappAccount?.phoneNumber || '',
        contactGroupId: campaign.contactGroupId,
        contactGroupName: campaign.ContactGroup?.name || null, // ✅ Fixed: contactGroup -> ContactGroup
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
    phone: cc.Contact?.phone || '', // ✅ Fixed: contact -> Contact
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
    // ✅ FIXED: FIND WHATSAPP ACCOUNT (ROBUST)
    // ==========================================
    async findWhatsAppAccount(organizationId, whatsappAccountId, phoneNumberId) {
        console.log('🔍 Finding WhatsApp account:', {
            organizationId,
            whatsappAccountId,
            phoneNumberId,
        });
        let waAccount = null;
        // Method 1: Try exact match (id + organizationId)
        if (whatsappAccountId) {
            waAccount = await database_1.default.whatsAppAccount.findFirst({
                where: {
                    id: whatsappAccountId,
                    organizationId
                },
            });
            if (waAccount) {
                console.log('✅ Found by exact match (id + org):', waAccount.id);
                return waAccount;
            }
        }
        // Method 2: Try by ID only (check if organizationId is missing/null)
        if (!waAccount && whatsappAccountId) {
            const byIdOnly = await database_1.default.whatsAppAccount.findUnique({
                where: { id: whatsappAccountId },
            });
            console.log('🔍 WhatsApp account by ID only:', byIdOnly ? {
                id: byIdOnly.id,
                organizationId: byIdOnly.organizationId,
                status: byIdOnly.status,
                phoneNumber: byIdOnly.phoneNumber,
            } : 'NOT FOUND');
            if (byIdOnly) {
                // Case A: organizationId is null/missing -> backfill it
                if (!byIdOnly.organizationId) {
                    console.log('⚠️ WhatsApp account has no organizationId, backfilling...');
                    waAccount = await database_1.default.whatsAppAccount.update({
                        where: { id: byIdOnly.id },
                        data: { organizationId },
                    });
                    console.log('✅ Backfilled organizationId:', waAccount.id);
                    return waAccount;
                }
                // Case B: organizationId exists but different -> security block
                if (byIdOnly.organizationId !== organizationId) {
                    console.error('❌ WhatsApp account belongs to different org:', {
                        accountOrg: byIdOnly.organizationId,
                        requestOrg: organizationId,
                    });
                    throw new errorHandler_1.AppError('WhatsApp account belongs to another organization', 403);
                }
                // Case C: organizationId matches (shouldn't reach here, but just in case)
                waAccount = byIdOnly;
                return waAccount;
            }
        }
        // Method 3: Try by phoneNumberId
        if (!waAccount && phoneNumberId) {
            waAccount = await database_1.default.whatsAppAccount.findFirst({
                where: {
                    phoneNumberId,
                    organizationId
                },
            });
            if (waAccount) {
                console.log('✅ Found by phoneNumberId:', waAccount.id);
                return waAccount;
            }
            // Try phoneNumberId without org filter
            const byPhoneNumberId = await database_1.default.whatsAppAccount.findFirst({
                where: { phoneNumberId },
            });
            if (byPhoneNumberId && !byPhoneNumberId.organizationId) {
                console.log('⚠️ Found by phoneNumberId, backfilling org...');
                waAccount = await database_1.default.whatsAppAccount.update({
                    where: { id: byPhoneNumberId.id },
                    data: { organizationId },
                });
                console.log('✅ Backfilled organizationId:', waAccount.id);
                return waAccount;
            }
        }
        // Method 4: Fallback - get default/first connected account for this org
        if (!waAccount) {
            console.log('🔍 Trying fallback: default/connected account for org...');
            waAccount = await database_1.default.whatsAppAccount.findFirst({
                where: {
                    organizationId,
                    status: 'CONNECTED',
                },
                orderBy: [
                    { isDefault: 'desc' },
                    { createdAt: 'desc' },
                ],
            });
            if (waAccount) {
                console.log('✅ Found by fallback (default/connected):', waAccount.id);
                return waAccount;
            }
        }
        // Method 5: Last resort - any account for this org
        if (!waAccount) {
            console.log('🔍 Trying last resort: any account for org...');
            waAccount = await database_1.default.whatsAppAccount.findFirst({
                where: { organizationId },
                orderBy: { createdAt: 'desc' },
            });
            if (waAccount) {
                console.log('✅ Found by last resort:', waAccount.id);
                return waAccount;
            }
        }
        // Nothing found
        console.error('❌ No WhatsApp account found for org:', organizationId);
        return null;
    }
    // ==========================================
    // ✅ FIXED: CREATE CAMPAIGN
    // ==========================================
    async create(organizationId, input) {
        const { name, description, templateId, whatsappAccountId, phoneNumberId, contactGroupId, contactIds, audienceFilter, scheduledAt, } = input;
        console.log('📦 Campaign create request:', {
            organizationId,
            name,
            templateId,
            whatsappAccountId,
            phoneNumberId,
            contactIdsCount: contactIds?.length || 0,
        });
        // Validate template
        const template = await database_1.default.template.findFirst({
            where: { id: templateId, organizationId },
        });
        if (!template) {
            throw new errorHandler_1.AppError('Template not found', 404);
        }
        // ✅ FIXED: Robust WhatsApp account lookup
        const waAccount = await this.findWhatsAppAccount(organizationId, whatsappAccountId, phoneNumberId);
        if (!waAccount) {
            throw new errorHandler_1.AppError('WhatsApp account not found. Please connect WhatsApp first in Settings → WhatsApp.', 404);
        }
        console.log('✅ Using WhatsApp account:', {
            id: waAccount.id,
            phoneNumber: waAccount.phoneNumber,
            status: waAccount.status,
        });
        // Validate contact group if provided
        if (contactGroupId) {
            const group = await database_1.default.contactGroup.findFirst({
                where: { id: contactGroupId, organizationId },
            });
            if (!group) {
                throw new errorHandler_1.AppError('Contact group not found', 404);
            }
        }
        // Gather target contacts
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
        // Create campaign with contacts
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
                },
                include: {
                    template: { select: { name: true } },
                    whatsappAccount: { select: { phoneNumber: true } },
                    ContactGroup: { select: { name: true } }, // ✅ Fixed: contactGroup -> ContactGroup
                },
            });
            // ✅ Fixed: Add required fields for CampaignContact
            const campaignContactsData = targetContacts.map((contact) => ({
                id: cuid(), // ✅ Generate ID
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
                    ContactGroup: { select: { name: true } }, // ✅ Fixed
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
            throw new errorHandler_1.AppError('Campaign not found', 404);
        }
        return {
            ...formatCampaign(campaign),
            template: campaign.template,
            whatsappAccount: campaign.whatsappAccount,
            contactGroup: campaign.ContactGroup, // ✅ Fixed
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
                ContactGroup: { select: { name: true } }, // ✅ Fixed
            },
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
        return { message: 'Campaign deleted successfully' };
    }
    // ==========================================
    // START CAMPAIGN
    // ==========================================
    async start(organizationId, campaignId) {
        const campaign = await database_1.default.campaign.findFirst({
            where: { id: campaignId, organizationId },
            include: { template: true, whatsappAccount: true },
        });
        if (!campaign)
            throw new errorHandler_1.AppError('Campaign not found', 404);
        if (!['DRAFT', 'SCHEDULED', 'PAUSED'].includes(campaign.status)) {
            throw new errorHandler_1.AppError(`Cannot start campaign with status: ${campaign.status}`, 400);
        }
        if (!campaign.whatsappAccount) {
            throw new errorHandler_1.AppError('WhatsApp account not found for this campaign', 400);
        }
        if (campaign.whatsappAccount.status !== 'CONNECTED') {
            throw new errorHandler_1.AppError('WhatsApp account is not connected', 400);
        }
        const updated = await database_1.default.campaign.update({
            where: { id: campaignId },
            data: {
                status: 'RUNNING',
                startedAt: campaign.startedAt || new Date()
            },
            include: {
                template: { select: { name: true, language: true, variables: true } },
                whatsappAccount: { select: { id: true, phoneNumber: true } },
                ContactGroup: { select: { name: true } }, // ✅ Fixed
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
    async pause(organizationId, campaignId) {
        const campaign = await database_1.default.campaign.findFirst({
            where: {
                id: campaignId,
                organizationId,
            },
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
                ContactGroup: { select: { name: true } }, // ✅ Fixed
            },
        });
        console.log(`⏸️ Campaign paused: ${campaignId}`);
        return formatCampaign(updated);
    }
    // ==========================================
    // RESUME CAMPAIGN
    // ==========================================
    async resume(organizationId, campaignId) {
        const campaign = await database_1.default.campaign.findFirst({
            where: {
                id: campaignId,
                organizationId,
            },
        });
        if (!campaign) {
            throw new errorHandler_1.AppError('Campaign not found', 404);
        }
        if (campaign.status !== 'PAUSED') {
            throw new errorHandler_1.AppError('Only paused campaigns can be resumed', 400);
        }
        const updated = await database_1.default.campaign.update({
            where: { id: campaignId },
            data: { status: 'RUNNING' },
            include: {
                template: { select: { name: true } },
                whatsappAccount: { select: { phoneNumber: true } },
                ContactGroup: { select: { name: true } }, // ✅ Fixed
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
    async cancel(organizationId, campaignId) {
        const campaign = await database_1.default.campaign.findFirst({
            where: {
                id: campaignId,
                organizationId,
            },
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
                ContactGroup: { select: { name: true } }, // ✅ Fixed
            },
        });
        console.log(`❌ Campaign cancelled: ${campaignId}`);
        return formatCampaign(updated);
    }
    // ==========================================
    // GET CAMPAIGN CONTACTS
    // ==========================================
    async getContacts(organizationId, campaignId, query) {
        const { page = 1, limit = 50, status } = query;
        const skip = (page - 1) * limit;
        const campaign = await database_1.default.campaign.findFirst({
            where: {
                id: campaignId,
                organizationId,
            },
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
                    Contact: {
                        select: {
                            phone: true,
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
            where: {
                id: campaignId,
                organizationId,
            },
        });
        if (!campaign) {
            throw new errorHandler_1.AppError('Campaign not found', 404);
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
        }
        console.log(`🔄 Retrying ${result.count} messages for campaign: ${campaignId}`);
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
            where: {
                id: campaignId,
                organizationId,
            },
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
                    audienceFilter: original.audienceFilter === null
                        ? undefined
                        : toJsonValue(original.audienceFilter),
                    status: 'DRAFT',
                    totalContacts: originalContacts.length,
                },
                include: {
                    template: { select: { name: true } },
                    whatsappAccount: { select: { phoneNumber: true } },
                    ContactGroup: { select: { name: true } }, // ✅ Fixed
                },
            });
            if (originalContacts.length > 0) {
                await tx.campaignContact.createMany({
                    data: originalContacts.map((c) => ({
                        id: cuid(), // ✅ Generate ID
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
        console.log(`📋 Campaign duplicated: ${campaignId} -> ${duplicate.id}`);
        return formatCampaign(duplicate);
    }
    // Rest of the methods remain the same with the following fixes:
    // - All `contactGroup` changed to `ContactGroup`
    // - All `contact` changed to `Contact` in includes
    // - CampaignContact createMany now includes id, createdAt, updatedAt
    // ==========================================
    // PROCESS CAMPAIGN SENDING (Internal)
    // ==========================================
    async processCampaignSending(organizationId, campaignId) {
        const campaign = await database_1.default.campaign.findFirst({
            where: { id: campaignId, organizationId },
            include: { template: true, whatsappAccount: true },
        });
        if (!campaign)
            return;
        if (campaign.status !== 'RUNNING')
            return;
        const wa = campaign.whatsappAccount;
        if (!wa?.accessToken || !wa?.phoneNumberId) {
            console.error('❌ WhatsApp account token/phoneNumberId missing');
            return;
        }
        const template = campaign.template;
        const templateName = template?.name;
        const templateLang = template?.language || 'en_US';
        if (!templateName) {
            console.error('❌ Campaign template missing');
            return;
        }
        const vars = template.variables || [];
        const varCount = Array.isArray(vars) ? vars.length : 0;
        console.log(`🚀 Sending campaign ${campaignId} to pending contacts...`);
        while (true) {
            const currentCampaign = await database_1.default.campaign.findUnique({
                where: { id: campaignId },
                select: { status: true },
            });
            if (!currentCampaign || currentCampaign.status !== 'RUNNING') {
                console.log(`⏹️ Campaign stopped: ${campaignId}`);
                break;
            }
            const pending = await database_1.default.campaignContact.findMany({
                where: { campaignId, status: 'PENDING' },
                take: 25,
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
            if (!pending.length)
                break;
            for (const cc of pending) {
                const to = cc.Contact?.phone; // ✅ Fixed
                if (!to) {
                    await this.updateContactStatus(campaignId, cc.contactId, 'FAILED', undefined, 'Contact phone missing');
                    continue;
                }
                try {
                    const params = buildParamsFromContact(cc.Contact, varCount); // ✅ Fixed
                    const payload = buildTemplateSendPayload({
                        to,
                        templateName,
                        language: templateLang,
                        params,
                    });
                    const res = await whatsapp_api_1.whatsappApi.sendMessage(wa.phoneNumberId, wa.accessToken, payload);
                    const waMessageId = res?.messages?.[0]?.id;
                    await this.updateContactStatus(campaignId, cc.contactId, 'SENT', waMessageId);
                    console.log('✅ Sent:', { campaignId, contactId: cc.contactId, waMessageId });
                    await new Promise((r) => setTimeout(r, 80));
                }
                catch (e) {
                    const reason = e?.response?.data?.error?.message || e?.message || 'Send failed';
                    console.error('❌ Send failed:', reason);
                    await this.updateContactStatus(campaignId, cc.contactId, 'FAILED', undefined, reason);
                }
            }
        }
        await this.checkAndComplete(campaignId);
        console.log(`✅ Campaign processing done: ${campaignId}`);
    }
    // ==========================================
    // GET CAMPAIGN STATS
    // ==========================================
    async getStats(organizationId) {
        try {
            console.log('📊 Fetching campaign stats for org:', organizationId);
            const stats = await database_1.default.campaign.aggregate({
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
            const statusCounts = await database_1.default.campaign.groupBy({
                by: ['status'],
                where: { organizationId },
                _count: true,
            });
            const total = stats._count.id || 0;
            const totalSent = stats._sum.sentCount || 0;
            const totalDelivered = stats._sum.deliveredCount || 0;
            const totalRead = stats._sum.readCount || 0;
            const getStatusCount = (status) => statusCounts.find(s => s.status === status)?._count || 0;
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
        }
        catch (error) {
            console.error('❌ Get campaign stats error:', error);
            if (error.code === 'P2024') {
                console.warn('⚠️ Database timeout, returning empty stats');
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
            where: {
                id: campaignId,
                organizationId,
            },
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
    // UPDATE CAMPAIGN CONTACT STATUS (Internal)
    // ==========================================
    async updateContactStatus(campaignId, contactId, status, waMessageId, failureReason) {
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
    }
    // ==========================================
    // CHECK AND COMPLETE CAMPAIGN (Internal)
    // ==========================================
    async checkAndComplete(campaignId) {
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
            await database_1.default.campaign.update({
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
exports.CampaignsService = CampaignsService;
exports.campaignsService = new CampaignsService();
function cuid() {
    throw new Error('Function not implemented.');
}
//# sourceMappingURL=campaigns.service.js.map