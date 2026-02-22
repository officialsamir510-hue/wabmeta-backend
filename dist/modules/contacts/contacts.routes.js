"use strict";
// src/modules/contacts/contacts.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const contacts_controller_1 = require("./contacts.controller");
const auth_1 = require("../../middleware/auth");
const validate_1 = require("../../middleware/validate");
const contacts_schema_1 = require("./contacts.schema");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authenticate);
// ============================================
// CONTACT ROUTES
// ============================================
// Get contact stats
router.get('/stats', contacts_controller_1.contactsController.getStats.bind(contacts_controller_1.contactsController));
// Get all tags
router.get('/tags', contacts_controller_1.contactsController.getTags.bind(contacts_controller_1.contactsController));
// Export contacts
router.get('/export', contacts_controller_1.contactsController.export.bind(contacts_controller_1.contactsController));
// Refresh unknown names (NEW)
router.post('/refresh-names', contacts_controller_1.contactsController.refreshUnknownNames.bind(contacts_controller_1.contactsController));
// Get contacts list
router.get('/', contacts_controller_1.contactsController.getList.bind(contacts_controller_1.contactsController));
// Create contact
router.post('/', (0, validate_1.validate)(contacts_schema_1.createContactSchema), contacts_controller_1.contactsController.create.bind(contacts_controller_1.contactsController));
// Import contacts
router.post('/import', (0, validate_1.validate)(contacts_schema_1.importContactsSchema), contacts_controller_1.contactsController.import.bind(contacts_controller_1.contactsController));
// Bulk update
router.patch('/bulk', (0, validate_1.validate)(contacts_schema_1.bulkUpdateSchema), contacts_controller_1.contactsController.bulkUpdate.bind(contacts_controller_1.contactsController));
// Bulk delete
router.delete('/bulk', (0, validate_1.validate)(contacts_schema_1.bulkDeleteSchema), contacts_controller_1.contactsController.bulkDelete.bind(contacts_controller_1.contactsController));
// Get contact by ID
router.get('/:id', contacts_controller_1.contactsController.getById.bind(contacts_controller_1.contactsController));
// Update contact
router.patch('/:id', (0, validate_1.validate)(contacts_schema_1.updateContactSchema), contacts_controller_1.contactsController.update.bind(contacts_controller_1.contactsController));
// Delete contact
router.delete('/:id', contacts_controller_1.contactsController.delete.bind(contacts_controller_1.contactsController));
// ============================================
// CONTACT GROUP ROUTES
// ============================================
// Get all groups
router.get('/groups/all', contacts_controller_1.contactsController.getGroups.bind(contacts_controller_1.contactsController));
// Create group
router.post('/groups', (0, validate_1.validate)(contacts_schema_1.createContactGroupSchema), contacts_controller_1.contactsController.createGroup.bind(contacts_controller_1.contactsController));
// Get group by ID
router.get('/groups/:groupId', contacts_controller_1.contactsController.getGroupById.bind(contacts_controller_1.contactsController));
// Update group
router.patch('/groups/:groupId', (0, validate_1.validate)(contacts_schema_1.updateContactGroupSchema), contacts_controller_1.contactsController.updateGroup.bind(contacts_controller_1.contactsController));
// Delete group
router.delete('/groups/:groupId', contacts_controller_1.contactsController.deleteGroup.bind(contacts_controller_1.contactsController));
// Get group contacts
router.get('/groups/:groupId/contacts', contacts_controller_1.contactsController.getGroupContacts.bind(contacts_controller_1.contactsController));
// Add contacts to group
router.post('/groups/:groupId/contacts', (0, validate_1.validate)(contacts_schema_1.addContactsToGroupSchema), contacts_controller_1.contactsController.addContactsToGroup.bind(contacts_controller_1.contactsController));
// Remove contacts from group
router.delete('/groups/:groupId/contacts', (0, validate_1.validate)(contacts_schema_1.addContactsToGroupSchema), contacts_controller_1.contactsController.removeContactsFromGroup.bind(contacts_controller_1.contactsController));
exports.default = router;
//# sourceMappingURL=contacts.routes.js.map