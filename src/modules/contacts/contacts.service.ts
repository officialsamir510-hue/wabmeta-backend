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

// ============================================
// HELPER FUNCTIONS
// ============================================

const formatContact = (contact: any): ContactResponse => ({
  id: contact.id,
  phone: contact.phone,
  countryCode: contact.countryCode,
  fullPhone: `${contact.countryCode}${contact.phone}`,
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
  createdAt: contact.createdAt,
  updatedAt: contact.updatedAt,
});

const formatContactWithGroups = (contact: any): ContactWithGroups => ({
  ...formatContact(contact),
  groups: contact.groupMemberships?.map((gm: any) => ({
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

// Normalize phone number
const normalizePhone = (phone: string): string => {
  return phone.replace(/\D/g, '').replace(/^0+/, '');
};

// ============================================
// CONTACTS SERVICE CLASS
// ============================================

export class ContactsService {
  // ==========================================
  // CREATE CONTACT
  // ==========================================
  async create(organizationId: string, input: CreateContactInput): Promise<ContactResponse> {
    const normalizedPhone = normalizePhone(input.phone);

    // Check for duplicate
    const existing = await prisma.contact.findUnique({
      where: {
        organizationId_phone: {
          organizationId,
          phone: normalizedPhone,
        },
      },
    });

    if (existing) {
      throw new AppError('Contact with this phone number already exists', 409);
    }

    // Check organization limits
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        subscription: {
          include: { plan: true },
        },
        _count: {
          select: { contacts: true },
        },
      },
    });

    if (org?.subscription?.plan) {
      if (org._count.contacts >= org.subscription.plan.maxContacts) {
        throw new AppError('Contact limit reached. Please upgrade your plan.', 400);
      }
    }

    // Create contact
    const contact = await prisma.contact.create({
      data: {
        organizationId,
        phone: normalizedPhone,
        countryCode: input.countryCode || '+91',
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        tags: input.tags || [],
        customFields: input.customFields || {},
        source: 'manual',
      },
    });

    // Add to groups if specified
    if (input.groupIds && input.groupIds.length > 0) {
      await prisma.contactGroupMember.createMany({
        data: input.groupIds.map((groupId) => ({
          contactId: contact.id,
          groupId,
        })),
        skipDuplicates: true,
      });
    }

    // Update subscription usage
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
    } = query;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.ContactWhereInput = {
      organizationId,
    };

    if (search) {
      where.OR = [
        { phone: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (tags && tags.length > 0) {
      where.tags = { hasSome: tags };
    }

    // ✅ Fixed: Use groupMemberships instead of groups
    if (groupId) {
      where.groupMemberships = {
        some: { groupId },
      };
    }

    // Execute query
    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.contact.count({ where }),
    ]);

    return {
      contacts: contacts.map(formatContact),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ==========================================
  // GET CONTACT BY ID
  // ==========================================
  async getById(organizationId: string, contactId: string): Promise<ContactWithGroups> {
    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        organizationId,
      },
      include: {
        // ✅ Fixed: Use groupMemberships instead of groups
        groupMemberships: {
          include: {
            group: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
        },
      },
    });

    if (!contact) {
      throw new AppError('Contact not found', 404);
    }

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
    // Check contact exists
    const existing = await prisma.contact.findFirst({
      where: {
        id: contactId,
        organizationId,
      },
    });

    if (!existing) {
      throw new AppError('Contact not found', 404);
    }

    // If phone is being updated, check for duplicates
    if (input.phone) {
      const normalizedPhone = normalizePhone(input.phone);
      const duplicate = await prisma.contact.findFirst({
        where: {
          organizationId,
          phone: normalizedPhone,
          id: { not: contactId },
        },
      });

      if (duplicate) {
        throw new AppError('Contact with this phone number already exists', 409);
      }
    }

    // Update contact
    const contact = await prisma.contact.update({
      where: { id: contactId },
      data: {
        phone: input.phone ? normalizePhone(input.phone) : undefined,
        countryCode: input.countryCode,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        tags: input.tags,
        customFields: input.customFields,
        status: input.status,
      },
    });

    return formatContact(contact);
  }

  // ==========================================
  // DELETE CONTACT
  // ==========================================
  async delete(organizationId: string, contactId: string): Promise<{ message: string }> {
    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        organizationId,
      },
    });

    if (!contact) {
      throw new AppError('Contact not found', 404);
    }

    await prisma.contact.delete({
      where: { id: contactId },
    });

    // Update subscription usage
    const subscription = await prisma.subscription.findFirst({
      where: { organizationId },
    });

    if (subscription && subscription.contactsUsed > 0) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { contactsUsed: { decrement: 1 } },
      });
    }

    return { message: 'Contact deleted successfully' };
  }

  // ==========================================
  // ✅ OPTIMIZED IMPORT CONTACTS
  // ==========================================
  /**
   * Import contacts in bulk (single DB query + optional group add)
   * Prevents Prisma pool timeout with efficient batch processing
   */
  async import(
    organizationId: string,
    input: ImportContactsInput
  ): Promise<ImportContactsResponse> {
    const {
      contacts,
      groupId,
      tags = [],
      skipDuplicates = true,
    } = input;

    if (!contacts || contacts.length === 0) {
      throw new AppError('At least one contact is required', 400);
    }

    // ✅ Optional group validation
    if (groupId) {
      const group = await prisma.contactGroup.findFirst({
        where: { id: groupId, organizationId },
        select: { id: true },
      });
      if (!group) {
        throw new AppError('Contact group not found', 404);
      }
    }

    // Check organization limits
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        subscription: {
          include: { plan: true },
        },
        _count: {
          select: { contacts: true },
        },
      },
    });

    const currentCount = org?._count.contacts || 0;
    const maxContacts = org?.subscription?.plan?.maxContacts || 100;
    const availableSlots = maxContacts - currentCount;

    if (availableSlots <= 0) {
      throw new AppError('Contact limit reached. Please upgrade your plan.', 400);
    }

    // Normalize + merge root tags
    const normalized = contacts.slice(0, availableSlots).map((c) => {
      const phone = normalizePhone(c.phone);
      const countryCode = c.countryCode || '+91';

      // Email: avoid empty string in DB
      const email = c.email ? String(c.email).trim() : null;
      const safeEmail = email && email.length > 0 ? email : null;

      const mergedTags = Array.from(
        new Set([...(c.tags || []), ...(tags || [])]
          .map((t) => String(t).trim())
          .filter(Boolean))
      );

      return {
        organizationId,
        phone,
        countryCode,
        firstName: c.firstName || null,
        lastName: c.lastName || null,
        email: safeEmail,
        tags: mergedTags,
        customFields: c.customFields || {},
        status: 'ACTIVE' as ContactStatus,
        source: 'import',
      };
    });

    // Filter invalid phones (should already be validated by zod, but extra safety)
    const valid = normalized.filter((c) => 
      c.phone && /^\d+$/.test(c.phone) && c.phone.length >= 10
    );

    const invalidCount = normalized.length - valid.length;
    if (valid.length === 0) {
      throw new AppError('No valid contacts found after normalization', 400);
    }

    // Remove duplicates inside same upload (reduces DB load)
    const seen = new Set<string>();
    const unique = valid.filter((c) => {
      const key = `${c.organizationId}:${c.phone}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // ✅ ONE QUERY bulk insert
    const createdRes = await prisma.contact.createMany({
      data: unique,
      skipDuplicates, // uses @@unique([organizationId, phone])
    });

    const imported = createdRes.count;
    const skipped = unique.length - imported;
    const errors: any[] = [];

    // ✅ Optionally add to group (2 small queries)
    let addedToGroup = 0;
    if (groupId && imported > 0) {
      try {
        const phones = unique.map((c) => c.phone);
        const createdContacts = await prisma.contact.findMany({
          where: { 
            organizationId, 
            phone: { in: phones },
            source: 'import' // Only get recently imported
          },
          select: { id: true },
        });

        if (createdContacts.length > 0) {
          const groupMembers = await prisma.contactGroupMember.createMany({
            data: createdContacts.map((ct) => ({
              groupId,
              contactId: ct.id,
            })),
            skipDuplicates: true,
          });
          addedToGroup = groupMembers.count;
        }
      } catch (err: any) {
        console.error('Failed to add contacts to group:', err);
        errors.push({
          row: 0,
          error: `Failed to add contacts to group: ${err.message}`,
        });
      }
    }

    // Update subscription usage if imported
    if (org?.subscription && imported > 0) {
      await prisma.subscription.update({
        where: { id: org.subscription.id },
        data: { contactsUsed: { increment: imported } },
      });
    }

    // Log import stats
    console.log(`✅ Import complete:`, {
      organizationId,
      total: contacts.length,
      imported,
      skipped,
      invalid: invalidCount,
      addedToGroup,
    });

    return {
      imported,
      skipped,
      failed: invalidCount,
      errors: errors.slice(0, 50), // Return max 50 errors
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

    // Verify all contacts belong to organization
    const contacts = await prisma.contact.findMany({
      where: {
        id: { in: contactIds },
        organizationId,
      },
    });

    if (contacts.length !== contactIds.length) {
      throw new AppError('Some contacts not found or access denied', 400);
    }

    // Update tags if provided
    if (tags && tags.length > 0) {
      for (const contact of contacts) {
        const newTags = [...new Set([...(contact.tags || []), ...tags])];
        await prisma.contact.update({
          where: { id: contact.id },
          data: { tags: newTags },
        });
      }
    }

    // Update status if provided
    if (status) {
      await prisma.contact.updateMany({
        where: { id: { in: contactIds } },
        data: { status },
      });
    }

    // Add to groups if provided
    if (groupIds && groupIds.length > 0) {
      const memberData = contactIds.flatMap((contactId) =>
        groupIds.map((groupId) => ({
          contactId,
          groupId,
        }))
      );

      await prisma.contactGroupMember.createMany({
        data: memberData,
        skipDuplicates: true,
      });
    }

    return {
      message: 'Contacts updated successfully',
      updated: contacts.length,
    };
  }

  // ==========================================
  // BULK DELETE CONTACTS
  // ==========================================
  async bulkDelete(
    organizationId: string,
    contactIds: string[]
  ): Promise<{ message: string; deleted: number }> {
    // Delete only contacts belonging to organization
    const result = await prisma.contact.deleteMany({
      where: {
        id: { in: contactIds },
        organizationId,
      },
    });

    // Update subscription usage
    const subscription = await prisma.subscription.findFirst({
      where: { organizationId },
    });

    if (subscription && result.count > 0) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          contactsUsed: {
            decrement: Math.min(result.count, subscription.contactsUsed),
          },
        },
      });
    }

    return {
      message: 'Contacts deleted successfully',
      deleted: result.count,
    };
  }

  // ==========================================
  // GET CONTACT STATS
  // ==========================================
  async getStats(organizationId: string): Promise<ContactStats> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [total, active, blocked, unsubscribed, recentlyAdded, withMessages] = await Promise.all([
      prisma.contact.count({ where: { organizationId } }),
      prisma.contact.count({ where: { organizationId, status: 'ACTIVE' } }),
      prisma.contact.count({ where: { organizationId, status: 'BLOCKED' } }),
      prisma.contact.count({ where: { organizationId, status: 'UNSUBSCRIBED' } }),
      prisma.contact.count({
        where: {
          organizationId,
          createdAt: { gte: sevenDaysAgo },
        },
      }),
      prisma.contact.count({
        where: {
          organizationId,
          messageCount: { gt: 0 },
        },
      }),
    ]);

    return {
      total,
      active,
      blocked,
      unsubscribed,
      recentlyAdded,
      withMessages,
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

    // Count tag occurrences
    const tagCounts = new Map<string, number>();
    for (const contact of contacts) {
      for (const tag of contact.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    // Convert to array and sort
    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }

  // ==========================================
  // EXPORT CONTACTS
  // ==========================================
  async export(organizationId: string, groupId?: string): Promise<any[]> {
    const where: Prisma.ContactWhereInput = { organizationId };

    // ✅ Fixed: Use groupMemberships instead of groups
    if (groupId) {
      where.groupMemberships = { some: { groupId } };
    }

    const contacts = await prisma.contact.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return contacts.map((contact) => ({
      phone: contact.phone,
      countryCode: contact.countryCode,
      fullPhone: `${contact.countryCode}${contact.phone}`,
      firstName: contact.firstName || '',
      lastName: contact.lastName || '',
      email: contact.email || '',
      tags: (contact.tags || []).join(', '),
      status: contact.status,
      source: contact.source || '',
      createdAt: contact.createdAt.toISOString(),
    }));
  }

  // ==========================================
  // CONTACT GROUPS (Remaining methods unchanged)
  // ==========================================

  // Create Group
  async createGroup(
    organizationId: string,
    input: CreateContactGroupInput
  ): Promise<ContactGroupResponse> {
    // Check for duplicate name
    const existing = await prisma.contactGroup.findUnique({
      where: {
        organizationId_name: {
          organizationId,
          name: input.name,
        },
      },
    });

    if (existing) {
      throw new AppError('Group with this name already exists', 409);
    }

    const group = await prisma.contactGroup.create({
      data: {
        organizationId,
        name: input.name,
        description: input.description,
        color: input.color || '#25D366',
      },
      include: {
        _count: { select: { members: true } },
      },
    });

    return formatContactGroup(group);
  }

  // Get All Groups
  async getGroups(organizationId: string): Promise<ContactGroupResponse[]> {
    const groups = await prisma.contactGroup.findMany({
      where: { organizationId },
      include: {
        _count: { select: { members: true } },
      },
      orderBy: { name: 'asc' },
    });

    return groups.map(formatContactGroup);
  }

  // Get Group By ID
  async getGroupById(
    organizationId: string,
    groupId: string
  ): Promise<ContactGroupResponse & { contacts: ContactResponse[] }> {
    const group = await prisma.contactGroup.findFirst({
      where: {
        id: groupId,
        organizationId,
      },
      include: {
        _count: { select: { members: true } },
        members: {
          include: { contact: true },
          take: 100,
        },
      },
    });

    if (!group) {
      throw new AppError('Group not found', 404);
    }

    return {
      ...formatContactGroup(group),
      contacts: group.members.map((m) => formatContact(m.contact)),
    };
  }

  // Update Group
  async updateGroup(
    organizationId: string,
    groupId: string,
    input: UpdateContactGroupInput
  ): Promise<ContactGroupResponse> {
    const group = await prisma.contactGroup.findFirst({
      where: {
        id: groupId,
        organizationId,
      },
    });

    if (!group) {
      throw new AppError('Group not found', 404);
    }

    // Check for duplicate name
    if (input.name && input.name !== group.name) {
      const existing = await prisma.contactGroup.findUnique({
        where: {
          organizationId_name: {
            organizationId,
            name: input.name,
          },
        },
      });

      if (existing) {
        throw new AppError('Group with this name already exists', 409);
      }
    }

    const updated = await prisma.contactGroup.update({
      where: { id: groupId },
      data: {
        name: input.name,
        description: input.description,
        color: input.color,
      },
      include: {
        _count: { select: { members: true } },
      },
    });

    return formatContactGroup(updated);
  }

  // Delete Group
  async deleteGroup(organizationId: string, groupId: string): Promise<{ message: string }> {
    const group = await prisma.contactGroup.findFirst({
      where: {
        id: groupId,
        organizationId,
      },
    });

    if (!group) {
      throw new AppError('Group not found', 404);
    }

    await prisma.contactGroup.delete({
      where: { id: groupId },
    });

    return { message: 'Group deleted successfully' };
  }

  // Add Contacts to Group
  async addContactsToGroup(
    organizationId: string,
    groupId: string,
    contactIds: string[]
  ): Promise<{ message: string; added: number }> {
    // Verify group exists
    const group = await prisma.contactGroup.findFirst({
      where: {
        id: groupId,
        organizationId,
      },
    });

    if (!group) {
      throw new AppError('Group not found', 404);
    }

    // Verify contacts exist
    const contacts = await prisma.contact.findMany({
      where: {
        id: { in: contactIds },
        organizationId,
      },
    });

    if (contacts.length === 0) {
      throw new AppError('No valid contacts found', 400);
    }

    // Add to group
    const result = await prisma.contactGroupMember.createMany({
      data: contacts.map((contact) => ({
        groupId,
        contactId: contact.id,
      })),
      skipDuplicates: true,
    });

    return {
      message: 'Contacts added to group successfully',
      added: result.count,
    };
  }

  // Remove Contacts from Group
  async removeContactsFromGroup(
    organizationId: string,
    groupId: string,
    contactIds: string[]
  ): Promise<{ message: string; removed: number }> {
    // Verify group exists
    const group = await prisma.contactGroup.findFirst({
      where: {
        id: groupId,
        organizationId,
      },
    });

    if (!group) {
      throw new AppError('Group not found', 404);
    }

    const result = await prisma.contactGroupMember.deleteMany({
      where: {
        groupId,
        contactId: { in: contactIds },
      },
    });

    return {
      message: 'Contacts removed from group successfully',
      removed: result.count,
    };
  }

  // Get Group Contacts
  async getGroupContacts(
    organizationId: string,
    groupId: string,
    query: ContactsQueryInput
  ): Promise<ContactsListResponse> {
    const { page = 1, limit = 20, search, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    // Verify group exists
    const group = await prisma.contactGroup.findFirst({
      where: {
        id: groupId,
        organizationId,
      },
    });

    if (!group) {
      throw new AppError('Group not found', 404);
    }

    const where: Prisma.ContactWhereInput = {
      organizationId,
      // ✅ Fixed: Use groupMemberships instead of groups
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
      prisma.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.contact.count({ where }),
    ]);

    return {
      contacts: contacts.map(formatContact),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

// Export singleton instance
export const contactsService = new ContactsService();