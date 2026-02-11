"use strict";
// src/modules/contacts/contacts.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const contacts_controller_1 = require("./contacts.controller");
const validate_1 = require("../../middleware/validate");
const auth_1 = require("../../middleware/auth");
const contacts_schema_1 = require("./contacts.schema");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authenticate);
// ============================================
// CONTACTS ROUTES
// ============================================
/**
 * @route   POST /api/v1/contacts
 * @desc    Create new contact
 * @access  Private
 */
router.post('/', (0, validate_1.validate)(contacts_schema_1.createContactSchema), contacts_controller_1.contactsController.create.bind(contacts_controller_1.contactsController));
/**
 * @route   GET /api/v1/contacts
 * @desc    Get contacts list with pagination
 * @access  Private
 */
router.get('/', (0, validate_1.validate)(contacts_schema_1.getContactsSchema), contacts_controller_1.contactsController.getList.bind(contacts_controller_1.contactsController));
/**
 * @route   GET /api/v1/contacts/stats
 * @desc    Get contact statistics
 * @access  Private
 */
router.get('/stats', contacts_controller_1.contactsController.getStats.bind(contacts_controller_1.contactsController));
/**
 * @route   GET /api/v1/contacts/tags
 * @desc    Get all tags with counts
 * @access  Private
 */
router.get('/tags', contacts_controller_1.contactsController.getTags.bind(contacts_controller_1.contactsController));
/**
 * @route   GET /api/v1/contacts/export
 * @desc    Export contacts as CSV
 * @access  Private
 */
router.get('/export', contacts_controller_1.contactsController.export.bind(contacts_controller_1.contactsController));
/**
 * @route   POST /api/v1/contacts/import
 * @desc    Import contacts from JSON/CSV data
 * @access  Private
 */
router.post('/import', (0, validate_1.validate)(contacts_schema_1.importContactsSchema), contacts_controller_1.contactsController.import.bind(contacts_controller_1.contactsController));
/**
 * @route   PUT /api/v1/contacts/bulk
 * @desc    Bulk update contacts
 * @access  Private
 */
router.put('/bulk', (0, validate_1.validate)(contacts_schema_1.bulkUpdateContactsSchema), contacts_controller_1.contactsController.bulkUpdate.bind(contacts_controller_1.contactsController));
/**
 * @route   DELETE /api/v1/contacts/bulk
 * @desc    Bulk delete contacts
 * @access  Private
 */
router.delete('/bulk', (0, validate_1.validate)(contacts_schema_1.bulkDeleteContactsSchema), contacts_controller_1.contactsController.bulkDelete.bind(contacts_controller_1.contactsController));
/**
 * @route   GET /api/v1/contacts/:id
 * @desc    Get contact by ID
 * @access  Private
 */
router.get('/:id', (0, validate_1.validate)(contacts_schema_1.getContactByIdSchema), contacts_controller_1.contactsController.getById.bind(contacts_controller_1.contactsController));
/**
 * @route   PUT /api/v1/contacts/:id
 * @desc    Update contact
 * @access  Private
 */
router.put('/:id', (0, validate_1.validate)(contacts_schema_1.updateContactSchema), contacts_controller_1.contactsController.update.bind(contacts_controller_1.contactsController));
/**
 * @route   DELETE /api/v1/contacts/:id
 * @desc    Delete contact
 * @access  Private
 */
router.delete('/:id', (0, validate_1.validate)(contacts_schema_1.deleteContactSchema), contacts_controller_1.contactsController.delete.bind(contacts_controller_1.contactsController));
// ============================================
// CONTACT GROUPS ROUTES
// ============================================
/**
 * @route   POST /api/v1/contacts/groups
 * @desc    Create contact group
 * @access  Private
 */
router.post('/groups', (0, validate_1.validate)(contacts_schema_1.createContactGroupSchema), contacts_controller_1.contactsController.createGroup.bind(contacts_controller_1.contactsController));
/**
 * @route   GET /api/v1/contacts/groups
 * @desc    Get all contact groups
 * @access  Private
 */
router.get('/groups', contacts_controller_1.contactsController.getGroups.bind(contacts_controller_1.contactsController));
/**
 * @route   GET /api/v1/contacts/groups/:groupId
 * @desc    Get contact group by ID
 * @access  Private
 */
router.get('/groups/:groupId', contacts_controller_1.contactsController.getGroupById.bind(contacts_controller_1.contactsController));
/**
 * @route   PUT /api/v1/contacts/groups/:groupId
 * @desc    Update contact group
 * @access  Private
 */
router.put('/groups/:groupId', (0, validate_1.validate)(contacts_schema_1.updateContactGroupSchema), contacts_controller_1.contactsController.updateGroup.bind(contacts_controller_1.contactsController));
/**
 * @route   DELETE /api/v1/contacts/groups/:groupId
 * @desc    Delete contact group
 * @access  Private
 */
router.delete('/groups/:groupId', (0, validate_1.validate)(contacts_schema_1.deleteContactGroupSchema), contacts_controller_1.contactsController.deleteGroup.bind(contacts_controller_1.contactsController));
/**
 * @route   GET /api/v1/contacts/groups/:groupId/contacts
 * @desc    Get contacts in a group
 * @access  Private
 */
router.get('/groups/:groupId/contacts', contacts_controller_1.contactsController.getGroupContacts.bind(contacts_controller_1.contactsController));
/**
 * @route   POST /api/v1/contacts/groups/:groupId/contacts
 * @desc    Add contacts to group
 * @access  Private
 */
router.post('/groups/:groupId/contacts', (0, validate_1.validate)(contacts_schema_1.addContactsToGroupSchema), contacts_controller_1.contactsController.addContactsToGroup.bind(contacts_controller_1.contactsController));
/**
 * @route   DELETE /api/v1/contacts/groups/:groupId/contacts
 * @desc    Remove contacts from group
 * @access  Private
 */
router.delete('/groups/:groupId/contacts', (0, validate_1.validate)(contacts_schema_1.removeContactsFromGroupSchema), contacts_controller_1.contactsController.removeContactsFromGroup.bind(contacts_controller_1.contactsController));
exports.default = router;
//# sourceMappingURL=contacts.routes.js.map