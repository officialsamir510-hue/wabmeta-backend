// src/modules/contacts/contacts.controller.ts

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../types/express';
import { contactsService } from './contacts.service';
import { sendSuccess } from '../../utils/response';
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

      const message = contact.whatsappProfileFetched
        ? 'Contact created with provided name'
        : 'Contact created - name will update when they send a message';

      sendSuccess(res, contact, message, 201);
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
        hasWhatsAppProfile: req.query.hasWhatsAppProfile === 'true' ? true :
          req.query.hasWhatsAppProfile === 'false' ? false : undefined,
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

      const id = req.params.id as string;
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

      const id = req.params.id as string;
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

      const id = req.params.id as string;
      const result = await contactsService.delete(organizationId, id);
      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // IMPORT CONTACTS (FIXED)
  // ==========================================
  async import(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      let input: ImportContactsInput & { csvData?: string; groupName?: string; groupId?: string } = req.body;

      // ✅ Handle file upload (multer)
      const file = (req as any).file;
      if (file) {
        const csvData = file.buffer.toString('utf-8');
        console.log(`📁 Received CSV file: ${file.originalname}, Size: ${file.size} bytes`);
        input.csvData = csvData;
      }

      // ✅ Handle raw CSV in body
      if (req.body.csvData && typeof req.body.csvData === 'string') {
        input.csvData = req.body.csvData;
      }

      // ✅ Handle contacts array directly
      if (req.body.contacts && Array.isArray(req.body.contacts)) {
        input.contacts = req.body.contacts;
      }

      // Get tags
      if (req.body.tags) {
        if (typeof req.body.tags === 'string') {
          try {
            input.tags = JSON.parse(req.body.tags);
          } catch {
            input.tags = req.body.tags.split(',').map((t: string) => t.trim());
          }
        } else if (Array.isArray(req.body.tags)) {
          input.tags = req.body.tags;
        }
      }

      // Get group info
      input.groupId = req.body.groupId;
      input.groupName = req.body.groupName;

      console.log('Import input:', {
        hasCSVData: !!input.csvData,
        csvLength: input.csvData?.length,
        contactsCount: input.contacts?.length,
        tags: input.tags,
        groupId: input.groupId,
        groupName: input.groupName,
      });

      const result = await contactsService.import(organizationId, input);

      const message = result.failed > 0
        ? `Imported ${result.imported} contacts. ${result.failed} failed (only Indian +91 numbers allowed).`
        : `Successfully imported ${result.imported} contacts.`;

      sendSuccess(res, result, message);
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

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=contacts.csv');

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
  // REFRESH UNKNOWN NAMES (NEW)
  // ==========================================
  async refreshUnknownNames(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const result = await contactsService.refreshUnknownNames(organizationId);
      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // CONTACT GROUPS
  // ==========================================

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

  async getGroupById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const groupId = req.params.groupId as string;
      const group = await contactsService.getGroupById(organizationId, groupId);
      sendSuccess(res, group, 'Group fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateGroup(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const groupId = req.params.groupId as string;
      const input: UpdateContactGroupInput = req.body;
      const group = await contactsService.updateGroup(organizationId, groupId, input);
      sendSuccess(res, group, 'Group updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteGroup(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const groupId = req.params.groupId as string;
      const result = await contactsService.deleteGroup(organizationId, groupId);
      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  async addContactsToGroup(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const groupId = req.params.groupId as string;
      const { contactIds } = req.body;
      const result = await contactsService.addContactsToGroup(organizationId, groupId, contactIds);
      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  async removeContactsFromGroup(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const groupId = req.params.groupId as string;
      const { contactIds } = req.body;
      const result = await contactsService.removeContactsFromGroup(organizationId, groupId, contactIds);
      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  async getGroupContacts(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const groupId = req.params.groupId as string;
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

export const contactsController = new ContactsController();