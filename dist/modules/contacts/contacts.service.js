"use strict";
// src/modules/contacts/contacts.service.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.contactsService = exports.ContactsService = void 0;
const database_1 = __importDefault(require("../../config/database"));
const errorHandler_1 = require("../../middleware/errorHandler");
const phone_1 = require("../../utils/phone");
// ============================================
// HELPER FUNCTIONS
// ============================================
const formatContact = (contact) => ({
    id: contact.id,
    phone: contact.phone,
    countryCode: contact.countryCode,
    fullPhone: (0, phone_1.formatFullPhone)(contact.countryCode, contact.phone),
    firstName: contact.firstName,
    lastName: contact.lastName,
    fullName: [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.phone,
    email: contact.email,
    avatar: contact.avatar,
    tags: contact.tags || [],
    customFields: contact.customFields || {},
    status: contact.status,
    source: contact.source,
    lastMessageAt: contact.lastMessageAt,
    messageCount: contact.messageCount,
    // WhatsApp Profile Fields
    whatsappProfileFetched: contact.whatsappProfileFetched || false,
    lastProfileFetchAt: contact.lastProfileFetchAt,
    profileFetchAttempts: contact.profileFetchAttempts || 0,
    whatsappProfileName: contact.whatsappProfileName,
    whatsappAbout: contact.whatsappAbout,
    whatsappProfilePicUrl: contact.whatsappProfilePicUrl,
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt,
});
const formatContactWithGroups = (contact) => ({
    ...formatContact(contact),
    groups: contact.groupMemberships?.map((gm) => ({
        id: gm.group.id,
        name: gm.group.name,
        color: gm.group.color,
    })) || [],
});
const formatContactGroup = (group) => ({
    id: group.id,
    name: group.name,
    description: group.description,
    color: group.color,
    contactCount: group._count?.members || 0,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
});
// ============================================
// CONTACTS SERVICE CLASS
// ============================================
class ContactsService {
    // ==========================================
    // PHONE VALIDATION HELPERS
    // ==========================================
    /**
     * Validate Indian phone number (10 digits starting with 6-9)
     */
    validateIndianPhone(phone) {
        const cleaned = phone.replace(/[\s\-\(\)]/g, '');
        const indianPhoneRegex = /^[6-9]\d{9}$/;
        return indianPhoneRegex.test(cleaned);
    }
    /**
     * Normalize phone to 10-digit format
     */
    normalizeToTenDigits(phone) {
        const cleaned = phone.replace(/[\s\-\(\)]/g, '');
        if (cleaned.startsWith('+91')) {
            return cleaned.substring(3);
        }
        else if (cleaned.startsWith('91')) {
            return cleaned.substring(2);
        }
        return cleaned;
    }
    /**
     * Validate and normalize phone (throws error if invalid)
     */
    validateAndNormalizePhone(phone) {
        const normalized = this.normalizeToTenDigits(phone);
        if (!this.validateIndianPhone(normalized)) {
            throw new errorHandler_1.AppError('Only Indian phone numbers (+91) starting with 6-9 are allowed', 400);
        }
        return normalized;
    }
    // ==========================================
    // WHATSAPP NAME FETCHING
    // ==========================================
    /**
     * Update contact from webhook (auto name fetch)
     */
    async updateContactFromWebhook(phone, profileName, organizationId) {
        try {
            const normalized = this.validateAndNormalizePhone(phone);
            const variants = (0, phone_1.buildINPhoneVariants)(phone);
            let contact = await database_1.default.contact.findFirst({
                where: {
                    organizationId,
                    OR: variants.map((p) => ({ phone: p })),
                },
            });
            if (contact) {
                // Update if name is Unknown or different
                if (!contact.firstName ||
                    contact.firstName === 'Unknown' ||
                    (profileName && profileName !== 'Unknown' && contact.firstName !== profileName)) {
                    contact = await database_1.default.contact.update({
                        where: { id: contact.id },
                        data: {
                            firstName: profileName,
                            whatsappProfileName: profileName,
                            phone: normalized,
                            whatsappProfileFetched: true,
                            lastProfileFetchAt: new Date(),
                            updatedAt: new Date(),
                        },
                    });
                    console.log(`✅ Updated contact: ${contact.phone} → ${profileName}`);
                }
            }
            else {
                // Create new contact from webhook
                contact = await database_1.default.contact.create({
                    data: {
                        organizationId,
                        phone: normalized,
                        countryCode: '+91',
                        firstName: profileName,
                        whatsappProfileName: profileName,
                        source: 'whatsapp',
                        status: 'ACTIVE',
                        whatsappProfileFetched: true,
                        lastProfileFetchAt: new Date(),
                    },
                });
                console.log(`✅ Created contact from webhook: ${profileName}`);
                // Update subscription usage
                const subscription = await database_1.default.subscription.findFirst({
                    where: { organizationId },
                });
                if (subscription) {
                    await database_1.default.subscription.update({
                        where: { id: subscription.id },
                        data: { contactsUsed: { increment: 1 } },
                    });
                }
            }
            return formatContact(contact);
        }
        catch (error) {
            console.error('Error updating contact from webhook:', error);
            return null;
        }
    }
    /**
     * Refresh unknown contact names
     */
    async refreshUnknownNames(organizationId) {
        const unknownContacts = await database_1.default.contact.findMany({
            where: {
                organizationId,
                OR: [
                    { firstName: null },
                    { firstName: 'Unknown' },
                    { whatsappProfileFetched: false },
                ],
            },
            take: 100,
        });
        return {
            total: unknownContacts.length,
            updated: 0,
            message: 'Names will be updated automatically when contacts send messages',
        };
    }
    // ==========================================
    // CREATE CONTACT
    // ==========================================
    async create(organizationId, input) {
        const national10 = this.validateAndNormalizePhone(input.phone);
        const variants = (0, phone_1.buildINPhoneVariants)(input.phone);
        // Duplicate check
        const existing = await database_1.default.contact.findFirst({
            where: {
                organizationId,
                OR: variants.map((p) => ({ phone: p })),
            },
        });
        if (existing) {
            throw new errorHandler_1.AppError('Contact with this phone number already exists', 409);
        }
        // Check organization limits
        const org = await database_1.default.organization.findUnique({
            where: { id: organizationId },
            include: {
                subscription: { include: { plan: true } },
                _count: { select: { contacts: true } },
            },
        });
        if (org?.subscription?.plan) {
            if (org._count.contacts >= org.subscription.plan.maxContacts) {
                throw new errorHandler_1.AppError('Contact limit reached. Please upgrade your plan.', 400);
            }
        }
        // Create contact
        const contact = await database_1.default.contact.create({
            data: {
                organizationId,
                phone: national10,
                countryCode: '+91',
                firstName: input.firstName || 'Unknown',
                lastName: input.lastName,
                email: input.email,
                tags: input.tags || [],
                customFields: input.customFields || {},
                source: 'manual',
                whatsappProfileFetched: !!input.firstName,
                profileFetchAttempts: 0,
            },
        });
        // Add to groups if specified
        if (input.groupIds && input.groupIds.length > 0) {
            await database_1.default.contactGroupMember.createMany({
                data: input.groupIds.map((groupId) => ({
                    contactId: contact.id,
                    groupId,
                })),
                skipDuplicates: true,
            });
        }
        // Update subscription usage
        if (org?.subscription) {
            await database_1.default.subscription.update({
                where: { id: org.subscription.id },
                data: { contactsUsed: { increment: 1 } },
            });
        }
        return formatContact(contact);
    }
    // ==========================================
    // GET CONTACTS LIST
    // ==========================================
    async getList(organizationId, query) {
        const { page = 1, limit = 20, search, status, tags, groupId, sortBy = 'createdAt', sortOrder = 'desc', hasWhatsAppProfile, } = query;
        // ✅ Allow higher limits but cap at 10000
        const safeLimit = Math.min(limit, 10000);
        const skip = (page - 1) * safeLimit;
        const where = { organizationId };
        if (search) {
            where.OR = [
                { phone: { contains: search, mode: 'insensitive' } },
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (status)
            where.status = status;
        if (tags && tags.length > 0)
            where.tags = { hasSome: tags };
        if (groupId)
            where.groupMemberships = { some: { groupId } };
        if (hasWhatsAppProfile !== undefined)
            where.whatsappProfileFetched = hasWhatsAppProfile;
        const [contacts, total] = await Promise.all([
            database_1.default.contact.findMany({
                where,
                skip,
                take: safeLimit,
                orderBy: { [sortBy]: sortOrder },
            }),
            database_1.default.contact.count({ where }),
        ]);
        return {
            contacts: contacts.map(formatContact),
            meta: { page, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) },
        };
    }
    // ==========================================
    // GET CONTACT BY ID
    // ==========================================
    async getById(organizationId, contactId) {
        const contact = await database_1.default.contact.findFirst({
            where: { id: contactId, organizationId },
            include: {
                groupMemberships: {
                    include: {
                        group: { select: { id: true, name: true, color: true } },
                    },
                },
            },
        });
        if (!contact)
            throw new errorHandler_1.AppError('Contact not found', 404);
        return formatContactWithGroups(contact);
    }
    // ==========================================
    // UPDATE CONTACT
    // ==========================================
    async update(organizationId, contactId, input) {
        const existing = await database_1.default.contact.findFirst({
            where: { id: contactId, organizationId },
        });
        if (!existing)
            throw new errorHandler_1.AppError('Contact not found', 404);
        let normalizedPhone;
        if (input.phone) {
            normalizedPhone = this.validateAndNormalizePhone(input.phone);
            const variants = (0, phone_1.buildINPhoneVariants)(input.phone);
            const duplicate = await database_1.default.contact.findFirst({
                where: {
                    organizationId,
                    id: { not: contactId },
                    OR: variants.map((p) => ({ phone: p })),
                },
            });
            if (duplicate) {
                throw new errorHandler_1.AppError('Contact with this phone number already exists', 409);
            }
        }
        const updateData = {
            phone: normalizedPhone,
            countryCode: input.countryCode || '+91',
            firstName: input.firstName,
            lastName: input.lastName,
            email: input.email,
            tags: input.tags,
            customFields: input.customFields,
            status: input.status,
        };
        if (input.firstName && input.firstName !== 'Unknown') {
            updateData.whatsappProfileFetched = true;
            updateData.lastProfileFetchAt = new Date();
        }
        const updated = await database_1.default.contact.update({
            where: { id: contactId },
            data: updateData,
        });
        return formatContact(updated);
    }
    // ==========================================
    // DELETE CONTACT
    // ==========================================
    async delete(organizationId, contactId) {
        const contact = await database_1.default.contact.findFirst({
            where: { id: contactId, organizationId },
        });
        if (!contact)
            throw new errorHandler_1.AppError('Contact not found', 404);
        await database_1.default.contact.delete({ where: { id: contactId } });
        const subscription = await database_1.default.subscription.findFirst({ where: { organizationId } });
        if (subscription && subscription.contactsUsed > 0) {
            await database_1.default.subscription.update({
                where: { id: subscription.id },
                data: { contactsUsed: { decrement: 1 } },
            });
        }
        return { message: 'Contact deleted successfully' };
    }
    // ==========================================
    // IMPORT CONTACTS (Updated with Group Support)
    // ==========================================
    async import(organizationId, input) {
        const { contacts, groupId, groupName, tags = [], skipDuplicates = true } = input;
        if (!contacts || contacts.length === 0) {
            throw new errorHandler_1.AppError('At least one contact is required', 400);
        }
        // 1. Resolve Target Group (Existing ID or New Name)
        let targetGroupId = groupId;
        if (!targetGroupId && groupName) {
            // Check if group exists by name
            const existingGroup = await database_1.default.contactGroup.findUnique({
                where: { organizationId_name: { organizationId, name: groupName } },
            });
            if (existingGroup) {
                targetGroupId = existingGroup.id;
            }
            else {
                // Create new group
                const newGroup = await database_1.default.contactGroup.create({
                    data: {
                        organizationId,
                        name: groupName,
                        description: 'Created via CSV Import',
                        color: '#25D366',
                    },
                });
                targetGroupId = newGroup.id;
            }
        }
        else if (targetGroupId) {
            // Verify existing group ID
            const group = await database_1.default.contactGroup.findFirst({
                where: { id: targetGroupId, organizationId },
            });
            if (!group)
                throw new errorHandler_1.AppError('Contact group not found', 404);
        }
        // 2. Check Limits
        const org = await database_1.default.organization.findUnique({
            where: { id: organizationId },
            include: {
                subscription: { include: { plan: true } },
                _count: { select: { contacts: true } },
            },
        });
        const currentCount = org?._count.contacts || 0;
        const maxContacts = org?.subscription?.plan?.maxContacts || 100;
        const availableSlots = maxContacts - currentCount;
        if (availableSlots <= 0) {
            throw new errorHandler_1.AppError('Contact limit reached. Please upgrade your plan.', 400);
        }
        // 3. Process Contacts
        const sliced = contacts.slice(0, availableSlots);
        const validContacts = [];
        const errors = [];
        for (let i = 0; i < sliced.length; i++) {
            const c = sliced[i];
            try {
                const normalized = this.validateAndNormalizePhone(c.phone);
                const mergedTags = Array.from(new Set([...(c.tags || []), ...tags]));
                validContacts.push({
                    organizationId,
                    phone: normalized,
                    countryCode: '+91',
                    firstName: c.firstName || 'Unknown',
                    lastName: c.lastName || null,
                    email: c.email || null,
                    tags: mergedTags,
                    customFields: c.customFields || {},
                    status: 'ACTIVE',
                    source: 'import',
                    whatsappProfileFetched: false,
                });
            }
            catch (error) {
                errors.push({
                    row: i + 1,
                    phone: c.phone,
                    error: error.message || 'Invalid Indian phone number',
                });
            }
        }
        if (validContacts.length === 0) {
            throw new errorHandler_1.AppError('No valid Indian phone numbers found.', 400);
        }
        // 4. Remove Duplicates in Batch
        const seen = new Set();
        const unique = validContacts.filter((c) => {
            if (seen.has(c.phone))
                return false;
            seen.add(c.phone);
            return true;
        });
        // 5. Insert Contacts
        // Note: We use createMany for speed.
        // If skipDuplicates=true, phones already in DB won't be re-inserted.
        // BUT we still need to add them to the group. So we need IDs.
        const createdRes = await database_1.default.contact.createMany({
            data: unique,
            skipDuplicates: true,
        });
        const imported = createdRes.count;
        const skipped = unique.length - imported; // roughly
        // 6. Add ALL Valid Contacts to Group
        let addedToGroup = 0;
        if (targetGroupId) {
            try {
                const phones = unique.map((c) => c.phone);
                // Fetch ALL valid contact IDs (newly created + existing)
                const allContactIds = await database_1.default.contact.findMany({
                    where: { organizationId, phone: { in: phones } },
                    select: { id: true },
                });
                if (allContactIds.length > 0) {
                    const groupMembers = await database_1.default.contactGroupMember.createMany({
                        data: allContactIds.map((ct) => ({
                            groupId: targetGroupId,
                            contactId: ct.id,
                        })),
                        skipDuplicates: true, // Ignore if already in group
                    });
                    addedToGroup = groupMembers.count;
                }
            }
            catch (err) {
                console.error('Failed to add contacts to group:', err);
                errors.push({ row: 0, error: `Group add failed: ${err.message}` });
            }
        }
        // 7. Update Subscription
        if (org?.subscription && imported > 0) {
            await database_1.default.subscription.update({
                where: { id: org.subscription.id },
                data: { contactsUsed: { increment: imported } },
            });
        }
        console.log(`✅ Import complete: ${imported} imported, ${addedToGroup} added to group ${targetGroupId}`);
        return {
            imported,
            skipped,
            failed: errors.length,
            errors: errors.slice(0, 50),
        };
    }
    // ==========================================
    // BULK UPDATE CONTACTS
    // ==========================================
    async bulkUpdate(organizationId, input) {
        const { contactIds, tags, groupIds, status } = input;
        const contacts = await database_1.default.contact.findMany({
            where: { id: { in: contactIds }, organizationId },
        });
        if (contacts.length !== contactIds.length) {
            throw new errorHandler_1.AppError('Some contacts not found or access denied', 400);
        }
        if (tags && tags.length > 0) {
            for (const contact of contacts) {
                const newTags = [...new Set([...(contact.tags || []), ...tags])];
                await database_1.default.contact.update({
                    where: { id: contact.id },
                    data: { tags: newTags },
                });
            }
        }
        if (status) {
            await database_1.default.contact.updateMany({
                where: { id: { in: contactIds } },
                data: { status },
            });
        }
        if (groupIds && groupIds.length > 0) {
            const memberData = contactIds.flatMap((contactId) => groupIds.map((groupId) => ({ contactId, groupId })));
            await database_1.default.contactGroupMember.createMany({
                data: memberData,
                skipDuplicates: true,
            });
        }
        return { message: 'Contacts updated successfully', updated: contacts.length };
    }
    // ==========================================
    // BULK DELETE CONTACTS
    // ==========================================
    async bulkDelete(organizationId, contactIds) {
        const result = await database_1.default.contact.deleteMany({
            where: { id: { in: contactIds }, organizationId },
        });
        const subscription = await database_1.default.subscription.findFirst({ where: { organizationId } });
        if (subscription && result.count > 0) {
            await database_1.default.subscription.update({
                where: { id: subscription.id },
                data: {
                    contactsUsed: { decrement: Math.min(result.count, subscription.contactsUsed) },
                },
            });
        }
        return { message: 'Contacts deleted successfully', deleted: result.count };
    }
    // ==========================================
    // GET CONTACT STATS
    // ==========================================
    async getStats(organizationId) {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const [total, active, blocked, unsubscribed, recentlyAdded, withMessages, whatsappVerified] = await Promise.all([
            database_1.default.contact.count({ where: { organizationId } }),
            database_1.default.contact.count({ where: { organizationId, status: 'ACTIVE' } }),
            database_1.default.contact.count({ where: { organizationId, status: 'BLOCKED' } }),
            database_1.default.contact.count({ where: { organizationId, status: 'UNSUBSCRIBED' } }),
            database_1.default.contact.count({ where: { organizationId, createdAt: { gte: sevenDaysAgo } } }),
            database_1.default.contact.count({ where: { organizationId, messageCount: { gt: 0 } } }),
            database_1.default.contact.count({ where: { organizationId, whatsappProfileFetched: true } }),
        ]);
        return {
            total,
            active,
            blocked,
            unsubscribed,
            recentlyAdded,
            withMessages,
            whatsappVerified,
        };
    }
    // ==========================================
    // GET ALL TAGS
    // ==========================================
    async getAllTags(organizationId) {
        const contacts = await database_1.default.contact.findMany({
            where: { organizationId },
            select: { tags: true },
        });
        const tagCounts = new Map();
        for (const contact of contacts) {
            for (const tag of contact.tags) {
                tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
            }
        }
        return Array.from(tagCounts.entries())
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => b.count - a.count);
    }
    // ==========================================
    // EXPORT CONTACTS
    // ==========================================
    async export(organizationId, groupId) {
        const where = { organizationId };
        if (groupId)
            where.groupMemberships = { some: { groupId } };
        const contacts = await database_1.default.contact.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });
        return contacts.map((contact) => ({
            phone: contact.phone,
            countryCode: contact.countryCode,
            fullPhone: (0, phone_1.formatFullPhone)(contact.countryCode, contact.phone),
            firstName: contact.firstName || '',
            lastName: contact.lastName || '',
            email: contact.email || '',
            tags: (contact.tags || []).join(', '),
            status: contact.status,
            source: contact.source || '',
            whatsappVerified: contact.whatsappProfileFetched ? 'Yes' : 'No',
            whatsappName: contact.whatsappProfileName || '',
            createdAt: contact.createdAt.toISOString(),
        }));
    }
    // ==========================================
    // CONTACT GROUPS
    // ==========================================
    async createGroup(organizationId, input) {
        const existing = await database_1.default.contactGroup.findUnique({
            where: { organizationId_name: { organizationId, name: input.name } },
        });
        if (existing)
            throw new errorHandler_1.AppError('Group with this name already exists', 409);
        const group = await database_1.default.contactGroup.create({
            data: {
                organizationId,
                name: input.name,
                description: input.description,
                color: input.color || '#25D366',
            },
            include: { _count: { select: { members: true } } },
        });
        return formatContactGroup(group);
    }
    async getGroups(organizationId) {
        const groups = await database_1.default.contactGroup.findMany({
            where: { organizationId },
            include: { _count: { select: { members: true } } },
            orderBy: { name: 'asc' },
        });
        return groups.map(formatContactGroup);
    }
    async getGroupById(organizationId, groupId) {
        const group = await database_1.default.contactGroup.findFirst({
            where: { id: groupId, organizationId },
            include: {
                _count: { select: { members: true } },
                members: { include: { contact: true }, take: 100 },
            },
        });
        if (!group)
            throw new errorHandler_1.AppError('Group not found', 404);
        return {
            ...formatContactGroup(group),
            contacts: group.members.map((m) => formatContact(m.contact)),
        };
    }
    async updateGroup(organizationId, groupId, input) {
        const group = await database_1.default.contactGroup.findFirst({
            where: { id: groupId, organizationId },
        });
        if (!group)
            throw new errorHandler_1.AppError('Group not found', 404);
        if (input.name && input.name !== group.name) {
            const existing = await database_1.default.contactGroup.findUnique({
                where: { organizationId_name: { organizationId, name: input.name } },
            });
            if (existing)
                throw new errorHandler_1.AppError('Group with this name already exists', 409);
        }
        const updated = await database_1.default.contactGroup.update({
            where: { id: groupId },
            data: {
                name: input.name,
                description: input.description,
                color: input.color,
            },
            include: { _count: { select: { members: true } } },
        });
        return formatContactGroup(updated);
    }
    async deleteGroup(organizationId, groupId) {
        const group = await database_1.default.contactGroup.findFirst({
            where: { id: groupId, organizationId },
        });
        if (!group)
            throw new errorHandler_1.AppError('Group not found', 404);
        await database_1.default.contactGroup.delete({ where: { id: groupId } });
        return { message: 'Group deleted successfully' };
    }
    async addContactsToGroup(organizationId, groupId, contactIds) {
        const group = await database_1.default.contactGroup.findFirst({
            where: { id: groupId, organizationId },
        });
        if (!group)
            throw new errorHandler_1.AppError('Group not found', 404);
        const contacts = await database_1.default.contact.findMany({
            where: { id: { in: contactIds }, organizationId },
        });
        if (contacts.length === 0)
            throw new errorHandler_1.AppError('No valid contacts found', 400);
        const result = await database_1.default.contactGroupMember.createMany({
            data: contacts.map((contact) => ({ groupId, contactId: contact.id })),
            skipDuplicates: true,
        });
        return { message: 'Contacts added to group successfully', added: result.count };
    }
    async removeContactsFromGroup(organizationId, groupId, contactIds) {
        const group = await database_1.default.contactGroup.findFirst({
            where: { id: groupId, organizationId },
        });
        if (!group)
            throw new errorHandler_1.AppError('Group not found', 404);
        const result = await database_1.default.contactGroupMember.deleteMany({
            where: { groupId, contactId: { in: contactIds } },
        });
        return { message: 'Contacts removed from group successfully', removed: result.count };
    }
    async getGroupContacts(organizationId, groupId, query) {
        const { page = 1, limit = 20, search, sortBy = 'createdAt', sortOrder = 'desc' } = query;
        const skip = (page - 1) * limit;
        const group = await database_1.default.contactGroup.findFirst({
            where: { id: groupId, organizationId },
        });
        if (!group)
            throw new errorHandler_1.AppError('Group not found', 404);
        const where = {
            organizationId,
            groupMemberships: { some: { groupId } },
        };
        if (search) {
            where.OR = [
                { phone: { contains: search, mode: 'insensitive' } },
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }
        const [contacts, total] = await Promise.all([
            database_1.default.contact.findMany({ where, skip, take: limit, orderBy: { [sortBy]: sortOrder } }),
            database_1.default.contact.count({ where }),
        ]);
        return {
            contacts: contacts.map(formatContact),
            meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }
}
exports.ContactsService = ContactsService;
exports.contactsService = new ContactsService();
//# sourceMappingURL=contacts.service.js.map