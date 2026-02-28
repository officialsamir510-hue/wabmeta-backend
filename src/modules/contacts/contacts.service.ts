// src/modules/contacts/contacts.service.ts

import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { ContactStatus, Prisma } from '@prisma/client';
import {
  CreateContactInput,
  UpdateContactInput,
  ImportContactsInput,
  BulkUpdateContactsInput,
  ContactsQueryInput,
  ContactResponse,
  ContactWithGroups,
  ContactsListResponse,
  ImportContactsResponse,
  ContactStats,
  CreateContactGroupInput,
  UpdateContactGroupInput,
  ContactGroupResponse,
} from './contacts.types';

import { buildINPhoneVariants, formatFullPhone, normalizeINNational10 } from '../../utils/phone';

// ============================================
// HELPER FUNCTIONS
// ============================================

const formatContact = (contact: any): ContactResponse => ({
  id: contact.id,
  phone: contact.phone,
  countryCode: contact.countryCode,
  fullPhone: formatFullPhone(contact.countryCode, contact.phone),
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
  whatsappProfileFetched: contact.whatsappProfileFetched || false,
  lastProfileFetchAt: contact.lastProfileFetchAt,
  profileFetchAttempts: contact.profileFetchAttempts || 0,
  whatsappProfileName: contact.whatsappProfileName,
  whatsappAbout: contact.whatsappAbout,
  whatsappProfilePicUrl: contact.whatsappProfilePicUrl,
  createdAt: contact.createdAt,
  updatedAt: contact.updatedAt,
});

const formatContactWithGroups = (contact: any): ContactWithGroups => ({
  ...formatContact(contact),
  groups:
    contact.groupMemberships?.map((gm: any) => ({
      id: gm.group.id,
      name: gm.group.name,
      color: gm.group.color,
    })) || [],
});

const formatContactGroup = (group: any): ContactGroupResponse => ({
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

export class ContactsService {

  // ==========================================
  // ✅ PHONE VALIDATION HELPERS (FIXED)
  // ==========================================

  /**
   * Validate Indian phone number (10 digits starting with 6-9)
   */
  private validateIndianPhone(phone: string): boolean {
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    const indianPhoneRegex = /^[6-9]\d{9}$/;
    return indianPhoneRegex.test(cleaned);
  }

  /**
   * Normalize phone to 10-digit format
   */
  private normalizeToTenDigits(phone: string): string {
    let cleaned = phone.replace(/[\s\-\(\)\+]/g, '');

    // Remove leading zeros
    cleaned = cleaned.replace(/^0+/, '');

    // Handle different formats
    if (cleaned.startsWith('91') && cleaned.length === 12) {
      return cleaned.substring(2);
    } else if (cleaned.length === 10) {
      return cleaned;
    }

    return cleaned;
  }

  /**
   * ✅ Validate and normalize phone (throws error if invalid)
   */
  private validateAndNormalizePhone(phone: string): string {
    const normalized = this.normalizeToTenDigits(phone);

    if (!this.validateIndianPhone(normalized)) {
      throw new AppError(
        `Invalid phone number: ${phone}. Only Indian numbers (+91) starting with 6-9 are allowed.`,
        400
      );
    }

    return normalized;
  }

  /**
   * ✅ Try to normalize phone - returns null if invalid (for import)
   */
  private tryNormalizePhone(phone: string): string | null {
    try {
      return this.validateAndNormalizePhone(phone);
    } catch {
      return null;
    }
  }

  // ==========================================
  // WHATSAPP NAME FETCHING
  // ==========================================

  async updateContactFromWebhook(
    phone: string,
    profileName: string,
    organizationId: string
  ): Promise<ContactResponse | null> {
    try {
      const normalized = this.tryNormalizePhone(phone);
      if (!normalized) return null;

      const variants = buildINPhoneVariants(phone);

      let contact = await prisma.contact.findFirst({
        where: {
          organizationId,
          OR: variants.map((p) => ({ phone: p })),
        },
      });

      if (contact) {
        if (
          !contact.firstName ||
          contact.firstName === 'Unknown' ||
          (profileName && profileName !== 'Unknown' && contact.firstName !== profileName)
        ) {
          contact = await prisma.contact.update({
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
      } else {
        contact = await prisma.contact.create({
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

        const subscription = await prisma.subscription.findFirst({
          where: { organizationId },
        });
        if (subscription) {
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: { contactsUsed: { increment: 1 } },
          });
        }
      }

      return formatContact(contact);
    } catch (error) {
      console.error('Error updating contact from webhook:', error);
      return null;
    }
  }

  async refreshUnknownNames(organizationId: string): Promise<{
    total: number;
    updated: number;
    message: string;
  }> {
    const unknownContacts = await prisma.contact.findMany({
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

  async create(organizationId: string, input: CreateContactInput): Promise<ContactResponse> {
    const national10 = this.validateAndNormalizePhone(input.phone);
    const variants = buildINPhoneVariants(input.phone);

    const existing = await prisma.contact.findFirst({
      where: {
        organizationId,
        OR: variants.map((p) => ({ phone: p })),
      },
    });

    if (existing) {
      throw new AppError('Contact with this phone number already exists', 409);
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        subscription: { include: { plan: true } },
        _count: { select: { contacts: true } },
      },
    });

    if (org?.subscription?.plan) {
      if (org._count.contacts >= org.subscription.plan.maxContacts) {
        throw new AppError('Contact limit reached. Please upgrade your plan.', 400);
      }
    }

    const contact = await prisma.contact.create({
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

    if (input.groupIds && input.groupIds.length > 0) {
      await prisma.contactGroupMember.createMany({
        data: input.groupIds.map((groupId) => ({
          contactId: contact.id,
          groupId,
        })),
        skipDuplicates: true,
      });
    }

    if (org?.subscription) {
      await prisma.subscription.update({
        where: { id: org.subscription.id },
        data: { contactsUsed: { increment: 1 } },
      });
    }

    return formatContact(contact);
  }

  // ==========================================
  // GET CONTACTS LIST
  // ==========================================

  async getList(organizationId: string, query: ContactsQueryInput): Promise<ContactsListResponse> {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      tags,
      groupId,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      hasWhatsAppProfile,
    } = query;

    const safeLimit = Math.min(limit, 10000);
    const skip = (page - 1) * safeLimit;
    const where: Prisma.ContactWhereInput = { organizationId };

    if (search) {
      where.OR = [
        { phone: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) where.status = status;
    if (tags && tags.length > 0) where.tags = { hasSome: tags };
    if (groupId) where.groupMemberships = { some: { groupId } };
    if (hasWhatsAppProfile !== undefined) where.whatsappProfileFetched = hasWhatsAppProfile;

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.contact.count({ where }),
    ]);

    return {
      contacts: contacts.map(formatContact),
      meta: { page, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) },
    };
  }

  // ==========================================
  // GET CONTACT BY ID
  // ==========================================

  async getById(organizationId: string, contactId: string): Promise<ContactWithGroups> {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, organizationId },
      include: {
        groupMemberships: {
          include: {
            group: { select: { id: true, name: true, color: true } },
          },
        },
      },
    });

    if (!contact) throw new AppError('Contact not found', 404);
    return formatContactWithGroups(contact);
  }

  // ==========================================
  // UPDATE CONTACT
  // ==========================================

  async update(
    organizationId: string,
    contactId: string,
    input: UpdateContactInput
  ): Promise<ContactResponse> {
    const existing = await prisma.contact.findFirst({
      where: { id: contactId, organizationId },
    });

    if (!existing) throw new AppError('Contact not found', 404);

    let normalizedPhone: string | undefined;

    if (input.phone) {
      normalizedPhone = this.validateAndNormalizePhone(input.phone);
      const variants = buildINPhoneVariants(input.phone);

      const duplicate = await prisma.contact.findFirst({
        where: {
          organizationId,
          id: { not: contactId },
          OR: variants.map((p) => ({ phone: p })),
        },
      });

      if (duplicate) {
        throw new AppError('Contact with this phone number already exists', 409);
      }
    }

    const updateData: any = {
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

    const updated = await prisma.contact.update({
      where: { id: contactId },
      data: updateData,
    });

    return formatContact(updated);
  }

  // ==========================================
  // DELETE CONTACT
  // ==========================================

  async delete(organizationId: string, contactId: string): Promise<{ message: string }> {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, organizationId },
    });

    if (!contact) throw new AppError('Contact not found', 404);

    await prisma.contact.delete({ where: { id: contactId } });

    const subscription = await prisma.subscription.findFirst({ where: { organizationId } });
    if (subscription && subscription.contactsUsed > 0) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { contactsUsed: { decrement: 1 } },
      });
    }

    return { message: 'Contact deleted successfully' };
  }

  // ==========================================
  // ✅ IMPORT CONTACTS (COMPLETE FIXED)
  // ==========================================

  async import(
    organizationId: string,
    input: ImportContactsInput & { groupName?: string }
  ): Promise<ImportContactsResponse> {
    const { contacts, groupId, groupName, tags = [], skipDuplicates = true } = input;

    if (!contacts || contacts.length === 0) {
      throw new AppError('At least one contact is required', 400);
    }

    console.log(`📊 Starting import of ${contacts.length} contacts for org ${organizationId}`);

    // ✅ 1. RESOLVE TARGET GROUP
    let targetGroupId = groupId;

    if (!targetGroupId && groupName) {
      const existingGroup = await prisma.contactGroup.findUnique({
        where: { organizationId_name: { organizationId, name: groupName } },
      });

      if (existingGroup) {
        targetGroupId = existingGroup.id;
        console.log(`✅ Using existing group: ${groupName}`);
      } else {
        const newGroup = await prisma.contactGroup.create({
          data: {
            organizationId,
            name: groupName,
            description: 'Created via CSV Import',
            color: '#25D366',
          },
        });
        targetGroupId = newGroup.id;
        console.log(`✅ Created new group: ${groupName}`);
      }
    } else if (targetGroupId) {
      const group = await prisma.contactGroup.findFirst({
        where: { id: targetGroupId, organizationId },
      });
      if (!group) throw new AppError('Contact group not found', 404);
    }

    // ✅ 2. CHECK LIMITS
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        subscription: { include: { plan: true } },
        _count: { select: { contacts: true } },
      },
    });

    const currentCount = org?._count.contacts || 0;
    const maxContacts = org?.subscription?.plan?.maxContacts || 100;
    const availableSlots = Math.max(0, maxContacts - currentCount);

    if (availableSlots === 0) {
      throw new AppError('Contact limit reached. Please upgrade your plan.', 400);
    }

    console.log(`📊 Available slots: ${availableSlots} (current: ${currentCount}, max: ${maxContacts})`);

    // ✅ 3. PROCESS & VALIDATE CONTACTS
    const validContacts: any[] = [];
    const errors: Array<{ row: number; phone: string; error: string }> = [];
    const seenPhones = new Set<string>();

    for (let i = 0; i < contacts.length; i++) {
      const c = contacts[i];
      const rowNumber = i + 1;

      try {
        // Normalize phone
        const normalized = this.tryNormalizePhone(c.phone);

        if (!normalized) {
          errors.push({
            row: rowNumber,
            phone: c.phone || 'N/A',
            error: 'Invalid phone number. Only Indian numbers (+91) starting with 6-9 are allowed.',
          });
          continue;
        }

        // Skip duplicates within CSV
        if (seenPhones.has(normalized)) {
          errors.push({
            row: rowNumber,
            phone: c.phone,
            error: 'Duplicate phone number in CSV',
          });
          continue;
        }

        seenPhones.add(normalized);

        // Merge tags
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
          status: 'ACTIVE' as ContactStatus,
          source: 'import',
          whatsappProfileFetched: false,
        });

      } catch (error: any) {
        errors.push({
          row: rowNumber,
          phone: c.phone || 'N/A',
          error: error.message || 'Unknown error',
        });
      }
    }

    console.log(`✅ Validated: ${validContacts.length} valid, ${errors.length} errors`);

    if (validContacts.length === 0) {
      return {
        imported: 0,
        skipped: 0,
        failed: errors.length,
        errors: errors.slice(0, 100),
      };
    }

    // ✅ 4. LIMIT TO AVAILABLE SLOTS
    const contactsToImport = validContacts.slice(0, availableSlots);
    const exceededCount = validContacts.length - contactsToImport.length;

    if (exceededCount > 0) {
      console.warn(`⚠️ Limit exceeded: ${exceededCount} contacts skipped`);
      for (let i = availableSlots; i < validContacts.length; i++) {
        errors.push({
          row: i + 1,
          phone: validContacts[i].phone,
          error: 'Contact limit reached',
        });
      }
    }

    // ✅ 5. CREATE CONTACTS (WITH DUPLICATE HANDLING)
    let imported = 0;
    let skipped = 0;

    try {
      const result = await prisma.contact.createMany({
        data: contactsToImport,
        skipDuplicates: true,
      });

      imported = result.count;
      skipped = contactsToImport.length - imported;

      console.log(`✅ Created ${imported} contacts, ${skipped} duplicates skipped`);

    } catch (error: any) {
      console.error('❌ Bulk insert failed:', error);
      throw new AppError(`Import failed: ${error.message}`, 500);
    }

    // ✅ 6. ADD TO GROUP (ALL VALID CONTACTS INCLUDING EXISTING)
    let addedToGroup = 0;

    if (targetGroupId && contactsToImport.length > 0) {
      try {
        const phones = contactsToImport.map((c) => c.phone);

        // Get ALL contact IDs (newly created + existing)
        const allContacts = await prisma.contact.findMany({
          where: {
            organizationId,
            phone: { in: phones }
          },
          select: { id: true },
        });

        if (allContacts.length > 0) {
          const groupMemberData = allContacts.map((ct) => ({
            groupId: targetGroupId!,
            contactId: ct.id,
          }));

          const groupResult = await prisma.contactGroupMember.createMany({
            data: groupMemberData,
            skipDuplicates: true,
          });

          addedToGroup = groupResult.count;
          console.log(`✅ Added ${addedToGroup} contacts to group ${targetGroupId}`);
        }
      } catch (err: any) {
        console.error('❌ Failed to add contacts to group:', err);
        errors.push({
          row: 0,
          phone: 'N/A',
          error: `Group add failed: ${err.message}`
        });
      }
    }

    // ✅ 7. UPDATE SUBSCRIPTION USAGE
    if (org?.subscription && imported > 0) {
      await prisma.subscription.update({
        where: { id: org.subscription.id },
        data: { contactsUsed: { increment: imported } },
      });
      console.log(`✅ Updated subscription usage: +${imported}`);
    }

    // ✅ 8. RETURN RESULTS
    return {
      imported,
      skipped,
      failed: errors.length,
      errors: errors.slice(0, 100), // Return first 100 errors
    };
  }

  // ==========================================
  // BULK UPDATE CONTACTS
  // ==========================================

  async bulkUpdate(
    organizationId: string,
    input: BulkUpdateContactsInput
  ): Promise<{ message: string; updated: number }> {
    const { contactIds, tags, groupIds, status } = input;

    const contacts = await prisma.contact.findMany({
      where: { id: { in: contactIds }, organizationId },
    });

    if (contacts.length !== contactIds.length) {
      throw new AppError('Some contacts not found or access denied', 400);
    }

    if (tags && tags.length > 0) {
      for (const contact of contacts) {
        const newTags = [...new Set([...(contact.tags || []), ...tags])];
        await prisma.contact.update({
          where: { id: contact.id },
          data: { tags: newTags },
        });
      }
    }

    if (status) {
      await prisma.contact.updateMany({
        where: { id: { in: contactIds } },
        data: { status },
      });
    }

    if (groupIds && groupIds.length > 0) {
      const memberData = contactIds.flatMap((contactId) =>
        groupIds.map((groupId) => ({ contactId, groupId }))
      );

      await prisma.contactGroupMember.createMany({
        data: memberData,
        skipDuplicates: true,
      });
    }

    return { message: 'Contacts updated successfully', updated: contacts.length };
  }

  // ==========================================
  // BULK DELETE CONTACTS
  // ==========================================

  async bulkDelete(
    organizationId: string,
    contactIds: string[]
  ): Promise<{ message: string; deleted: number }> {
    const result = await prisma.contact.deleteMany({
      where: { id: { in: contactIds }, organizationId },
    });

    const subscription = await prisma.subscription.findFirst({ where: { organizationId } });

    if (subscription && result.count > 0) {
      await prisma.subscription.update({
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

  async getStats(organizationId: string): Promise<ContactStats> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [total, active, blocked, unsubscribed, recentlyAdded, withMessages, whatsappVerified] =
      await Promise.all([
        prisma.contact.count({ where: { organizationId } }),
        prisma.contact.count({ where: { organizationId, status: 'ACTIVE' } }),
        prisma.contact.count({ where: { organizationId, status: 'BLOCKED' } }),
        prisma.contact.count({ where: { organizationId, status: 'UNSUBSCRIBED' } }),
        prisma.contact.count({ where: { organizationId, createdAt: { gte: sevenDaysAgo } } }),
        prisma.contact.count({ where: { organizationId, messageCount: { gt: 0 } } }),
        prisma.contact.count({ where: { organizationId, whatsappProfileFetched: true } }),
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

  async getAllTags(organizationId: string): Promise<{ tag: string; count: number }[]> {
    const contacts = await prisma.contact.findMany({
      where: { organizationId },
      select: { tags: true },
    });

    const tagCounts = new Map<string, number>();
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

  async export(organizationId: string, groupId?: string): Promise<any[]> {
    const where: Prisma.ContactWhereInput = { organizationId };
    if (groupId) where.groupMemberships = { some: { groupId } };

    const contacts = await prisma.contact.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return contacts.map((contact) => ({
      phone: contact.phone,
      countryCode: contact.countryCode,
      fullPhone: formatFullPhone(contact.countryCode, contact.phone),
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
  // CONTACT GROUPS (Unchanged)
  // ==========================================

  async createGroup(organizationId: string, input: CreateContactGroupInput): Promise<ContactGroupResponse> {
    const existing = await prisma.contactGroup.findUnique({
      where: { organizationId_name: { organizationId, name: input.name } },
    });

    if (existing) throw new AppError('Group with this name already exists', 409);

    const group = await prisma.contactGroup.create({
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

  async getGroups(organizationId: string): Promise<ContactGroupResponse[]> {
    const groups = await prisma.contactGroup.findMany({
      where: { organizationId },
      include: { _count: { select: { members: true } } },
      orderBy: { name: 'asc' },
    });

    return groups.map(formatContactGroup);
  }

  async getGroupById(organizationId: string, groupId: string): Promise<ContactGroupResponse & { contacts: ContactResponse[] }> {
    const group = await prisma.contactGroup.findFirst({
      where: { id: groupId, organizationId },
      include: {
        _count: { select: { members: true } },
        members: { include: { contact: true }, take: 100 },
      },
    });

    if (!group) throw new AppError('Group not found', 404);

    return {
      ...formatContactGroup(group),
      contacts: group.members.map((m) => formatContact(m.contact)),
    };
  }

  async updateGroup(organizationId: string, groupId: string, input: UpdateContactGroupInput): Promise<ContactGroupResponse> {
    const group = await prisma.contactGroup.findFirst({
      where: { id: groupId, organizationId },
    });

    if (!group) throw new AppError('Group not found', 404);

    if (input.name && input.name !== group.name) {
      const existing = await prisma.contactGroup.findUnique({
        where: { organizationId_name: { organizationId, name: input.name } },
      });
      if (existing) throw new AppError('Group with this name already exists', 409);
    }

    const updated = await prisma.contactGroup.update({
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

  async deleteGroup(organizationId: string, groupId: string): Promise<{ message: string }> {
    const group = await prisma.contactGroup.findFirst({
      where: { id: groupId, organizationId },
    });

    if (!group) throw new AppError('Group not found', 404);

    await prisma.contactGroup.delete({ where: { id: groupId } });
    return { message: 'Group deleted successfully' };
  }

  async addContactsToGroup(organizationId: string, groupId: string, contactIds: string[]): Promise<{ message: string; added: number }> {
    const group = await prisma.contactGroup.findFirst({
      where: { id: groupId, organizationId },
    });

    if (!group) throw new AppError('Group not found', 404);

    const contacts = await prisma.contact.findMany({
      where: { id: { in: contactIds }, organizationId },
    });

    if (contacts.length === 0) throw new AppError('No valid contacts found', 400);

    const result = await prisma.contactGroupMember.createMany({
      data: contacts.map((contact) => ({ groupId, contactId: contact.id })),
      skipDuplicates: true,
    });

    return { message: 'Contacts added to group successfully', added: result.count };
  }

  async removeContactsFromGroup(organizationId: string, groupId: string, contactIds: string[]): Promise<{ message: string; removed: number }> {
    const group = await prisma.contactGroup.findFirst({
      where: { id: groupId, organizationId },
    });

    if (!group) throw new AppError('Group not found', 404);

    const result = await prisma.contactGroupMember.deleteMany({
      where: { groupId, contactId: { in: contactIds } },
    });

    return { message: 'Contacts removed from group successfully', removed: result.count };
  }

  async getGroupContacts(organizationId: string, groupId: string, query: ContactsQueryInput): Promise<ContactsListResponse> {
    const { page = 1, limit = 20, search, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    const group = await prisma.contactGroup.findFirst({
      where: { id: groupId, organizationId },
    });

    if (!group) throw new AppError('Group not found', 404);

    const where: Prisma.ContactWhereInput = {
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
      prisma.contact.findMany({ where, skip, take: limit, orderBy: { [sortBy]: sortOrder } }),
      prisma.contact.count({ where }),
    ]);

    return {
      contacts: contacts.map(formatContact),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}

export const contactsService = new ContactsService();