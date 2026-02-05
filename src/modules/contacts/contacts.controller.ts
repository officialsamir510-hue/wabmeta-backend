// src/modules/contacts/contacts.controller.ts

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../types/express';
import { contactsService } from './contacts.service';
import { sendSuccess, sendPaginated } from '../../utils/response';
import { AppError } from '../../middleware/errorHandler';
import {
  CreateContactInput,
  UpdateContactInput,
  ImportContactsInput,
  BulkUpdateContactsInput,
  ContactsQueryInput,
  CreateContactGroupInput,
  UpdateContactGroupInput,
} from './contacts.types';

export class ContactsController {
  // ==========================================
  // CREATE CONTACT
  // ==========================================
  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const input: CreateContactInput = req.body;
      const contact = await contactsService.create(organizationId, input);
      sendSuccess(res, contact, 'Contact created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET CONTACTS LIST
  // ==========================================
  async getList(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const query: ContactsQueryInput = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        search: req.query.search as string,
        status: req.query.status as any,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
        groupId: req.query.groupId as string,
        sortBy: (req.query.sortBy as any) || 'createdAt',
        sortOrder: (req.query.sortOrder as any) || 'desc',
      };

      const result = await contactsService.getList(organizationId, query);
      res.json({
        success: true,
        message: 'Contacts fetched successfully',
        data: result.contacts,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET CONTACT BY ID
  // ==========================================
  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const { id } = req.params;
      const contact = await contactsService.getById(organizationId, id);
      sendSuccess(res, contact, 'Contact fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // UPDATE CONTACT
  // ==========================================
  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const { id } = req.params;
      const input: UpdateContactInput = req.body;
      const contact = await contactsService.update(organizationId, id, input);
      sendSuccess(res, contact, 'Contact updated successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // DELETE CONTACT
  // ==========================================
  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const { id } = req.params;
      const result = await contactsService.delete(organizationId, id);
      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // IMPORT CONTACTS
  // ==========================================
  async import(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const input: ImportContactsInput = req.body;
      const result = await contactsService.import(organizationId, input);
      sendSuccess(res, result, `Imported ${result.imported} contacts`);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // BULK UPDATE CONTACTS
  // ==========================================
  async bulkUpdate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const input: BulkUpdateContactsInput = req.body;
      const result = await contactsService.bulkUpdate(organizationId, input);
      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // BULK DELETE CONTACTS
  // ==========================================
  async bulkDelete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const { contactIds } = req.body;
      const result = await contactsService.bulkDelete(organizationId, contactIds);
      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET CONTACT STATS
  // ==========================================
  async getStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const stats = await contactsService.getStats(organizationId);
      sendSuccess(res, stats, 'Stats fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET ALL TAGS
  // ==========================================
  async getTags(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const tags = await contactsService.getAllTags(organizationId);
      sendSuccess(res, tags, 'Tags fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // EXPORT CONTACTS
  // ==========================================
  async export(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const { groupId } = req.query;
      const contacts = await contactsService.export(organizationId, groupId as string);

      // Set headers for CSV download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=contacts.csv');

      // Generate CSV
      if (contacts.length === 0) {
        res.send('No contacts found');
        return;
      }

      const headers = Object.keys(contacts[0]).join(',');
      const rows = contacts.map((contact) =>
        Object.values(contact)
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      );

      const csv = [headers, ...rows].join('\n');
      res.send(csv);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // CONTACT GROUPS
  // ==========================================

  // Create Group
  async createGroup(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const input: CreateContactGroupInput = req.body;
      const group = await contactsService.createGroup(organizationId, input);
      sendSuccess(res, group, 'Group created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  // Get All Groups
  async getGroups(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const groups = await contactsService.getGroups(organizationId);
      sendSuccess(res, groups, 'Groups fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // Get Group By ID
  async getGroupById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const { groupId } = req.params;
      const group = await contactsService.getGroupById(organizationId, groupId);
      sendSuccess(res, group, 'Group fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // Update Group
  async updateGroup(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const { groupId } = req.params;
      const input: UpdateContactGroupInput = req.body;
      const group = await contactsService.updateGroup(organizationId, groupId, input);
      sendSuccess(res, group, 'Group updated successfully');
    } catch (error) {
      next(error);
    }
  }

  // Delete Group
  async deleteGroup(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const { groupId } = req.params;
      const result = await contactsService.deleteGroup(organizationId, groupId);
      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // Add Contacts to Group
  async addContactsToGroup(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const { groupId } = req.params;
      const { contactIds } = req.body;
      const result = await contactsService.addContactsToGroup(organizationId, groupId, contactIds);
      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // Remove Contacts from Group
  async removeContactsFromGroup(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const { groupId } = req.params;
      const { contactIds } = req.body;
      const result = await contactsService.removeContactsFromGroup(organizationId, groupId, contactIds);
      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // Get Group Contacts
  async getGroupContacts(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const { groupId } = req.params;
      const query: ContactsQueryInput = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        search: req.query.search as string,
        sortBy: (req.query.sortBy as any) || 'createdAt',
        sortOrder: (req.query.sortOrder as any) || 'desc',
      };

      const result = await contactsService.getGroupContacts(organizationId, groupId, query);
      res.json({
        success: true,
        message: 'Group contacts fetched successfully',
        data: result.contacts,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const contactsController = new ContactsController();