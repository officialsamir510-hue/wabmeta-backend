"use strict";
// src/modules/contacts/contacts.controller.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.contactsController = exports.ContactsController = void 0;
const contacts_service_1 = require("./contacts.service");
const response_1 = require("../../utils/response");
const errorHandler_1 = require("../../middleware/errorHandler");
class ContactsController {
    // ==========================================
    // CREATE CONTACT
    // ==========================================
    async create(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const input = req.body;
            const contact = await contacts_service_1.contactsService.create(organizationId, input);
            (0, response_1.sendSuccess)(res, contact, 'Contact created successfully', 201);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // GET CONTACTS LIST
    // ==========================================
    async getList(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const query = {
                page: parseInt(req.query.page) || 1,
                limit: parseInt(req.query.limit) || 20,
                search: req.query.search,
                status: req.query.status,
                tags: req.query.tags ? req.query.tags.split(',') : undefined,
                groupId: req.query.groupId,
                sortBy: req.query.sortBy || 'createdAt',
                sortOrder: req.query.sortOrder || 'desc',
            };
            const result = await contacts_service_1.contactsService.getList(organizationId, query);
            res.json({
                success: true,
                message: 'Contacts fetched successfully',
                data: result.contacts,
                meta: result.meta,
            });
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // GET CONTACT BY ID
    // ==========================================
    async getById(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const id = req.params.id; // ✅ Fixed
            const contact = await contacts_service_1.contactsService.getById(organizationId, id);
            (0, response_1.sendSuccess)(res, contact, 'Contact fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // UPDATE CONTACT
    // ==========================================
    async update(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const id = req.params.id; // ✅ Fixed
            const input = req.body;
            const contact = await contacts_service_1.contactsService.update(organizationId, id, input);
            (0, response_1.sendSuccess)(res, contact, 'Contact updated successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // DELETE CONTACT
    // ==========================================
    async delete(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const id = req.params.id; // ✅ Fixed
            const result = await contacts_service_1.contactsService.delete(organizationId, id);
            (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // IMPORT CONTACTS
    // ==========================================
    async import(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const input = req.body;
            const result = await contacts_service_1.contactsService.import(organizationId, input);
            (0, response_1.sendSuccess)(res, result, `Imported ${result.imported} contacts`);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // BULK UPDATE CONTACTS
    // ==========================================
    async bulkUpdate(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const input = req.body;
            const result = await contacts_service_1.contactsService.bulkUpdate(organizationId, input);
            (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // BULK DELETE CONTACTS
    // ==========================================
    async bulkDelete(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const { contactIds } = req.body;
            const result = await contacts_service_1.contactsService.bulkDelete(organizationId, contactIds);
            (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // GET CONTACT STATS
    // ==========================================
    async getStats(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const stats = await contacts_service_1.contactsService.getStats(organizationId);
            (0, response_1.sendSuccess)(res, stats, 'Stats fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // GET ALL TAGS
    // ==========================================
    async getTags(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const tags = await contacts_service_1.contactsService.getAllTags(organizationId);
            (0, response_1.sendSuccess)(res, tags, 'Tags fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // EXPORT CONTACTS
    // ==========================================
    async export(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const { groupId } = req.query;
            const contacts = await contacts_service_1.contactsService.export(organizationId, groupId);
            // Set headers for CSV download
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=contacts.csv');
            // Generate CSV
            if (contacts.length === 0) {
                res.send('No contacts found');
                return;
            }
            const headers = Object.keys(contacts[0]).join(',');
            const rows = contacts.map((contact) => Object.values(contact)
                .map((v) => `"${String(v).replace(/"/g, '""')}"`)
                .join(','));
            const csv = [headers, ...rows].join('\n');
            res.send(csv);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // CONTACT GROUPS
    // ==========================================
    // Create Group
    async createGroup(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const input = req.body;
            const group = await contacts_service_1.contactsService.createGroup(organizationId, input);
            (0, response_1.sendSuccess)(res, group, 'Group created successfully', 201);
        }
        catch (error) {
            next(error);
        }
    }
    // Get All Groups
    async getGroups(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const groups = await contacts_service_1.contactsService.getGroups(organizationId);
            (0, response_1.sendSuccess)(res, groups, 'Groups fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // Get Group By ID
    async getGroupById(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const groupId = req.params.groupId; // ✅ Fixed
            const group = await contacts_service_1.contactsService.getGroupById(organizationId, groupId);
            (0, response_1.sendSuccess)(res, group, 'Group fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // Update Group
    async updateGroup(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const groupId = req.params.groupId; // ✅ Fixed
            const input = req.body;
            const group = await contacts_service_1.contactsService.updateGroup(organizationId, groupId, input);
            (0, response_1.sendSuccess)(res, group, 'Group updated successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // Delete Group
    async deleteGroup(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const groupId = req.params.groupId; // ✅ Fixed
            const result = await contacts_service_1.contactsService.deleteGroup(organizationId, groupId);
            (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // Add Contacts to Group
    async addContactsToGroup(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const groupId = req.params.groupId; // ✅ Fixed
            const { contactIds } = req.body;
            const result = await contacts_service_1.contactsService.addContactsToGroup(organizationId, groupId, contactIds);
            (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // Remove Contacts from Group
    async removeContactsFromGroup(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const groupId = req.params.groupId; // ✅ Fixed
            const { contactIds } = req.body;
            const result = await contacts_service_1.contactsService.removeContactsFromGroup(organizationId, groupId, contactIds);
            (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // Get Group Contacts
    async getGroupContacts(req, res, next) {
        try {
            const organizationId = req.user?.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const groupId = req.params.groupId; // ✅ Fixed
            const query = {
                page: parseInt(req.query.page) || 1,
                limit: parseInt(req.query.limit) || 20,
                search: req.query.search,
                sortBy: req.query.sortBy || 'createdAt',
                sortOrder: req.query.sortOrder || 'desc',
            };
            const result = await contacts_service_1.contactsService.getGroupContacts(organizationId, groupId, query);
            res.json({
                success: true,
                message: 'Group contacts fetched successfully',
                data: result.contacts,
                meta: result.meta,
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.ContactsController = ContactsController;
// Export singleton instance
exports.contactsController = new ContactsController();
//# sourceMappingURL=contacts.controller.js.map