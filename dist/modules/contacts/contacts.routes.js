"use strict";
// src/modules/contacts/contacts.routes.ts - COMPLETE FIXED
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const contacts_controller_1 = require("./contacts.controller");
const auth_1 = require("../../middleware/auth");
const validate_1 = require("../../middleware/validate");
const planLimits_1 = require("../../middleware/planLimits");
const contacts_schema_1 = require("./contacts.schema");
const contacts_import_middleware_1 = require("./contacts.import.middleware");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
// All routes require authentication
router.use(auth_1.authenticate);
// ============================================
// CONTACT ROUTES (STATIC FIRST)
// ============================================
router.get('/stats', contacts_controller_1.contactsController.getStats.bind(contacts_controller_1.contactsController));
router.get('/tags', contacts_controller_1.contactsController.getTags.bind(contacts_controller_1.contactsController));
router.get('/export', contacts_controller_1.contactsController.export.bind(contacts_controller_1.contactsController));
router.post('/refresh-profiles/batch', contacts_controller_1.contactsController.refreshUnknownNames.bind(contacts_controller_1.contactsController));
router.post('/refresh-names', contacts_controller_1.contactsController.refreshUnknownNames.bind(contacts_controller_1.contactsController));
// ============================================
// CONTACT GROUP ROUTES (MUST BE BEFORE /:id)
// ============================================
router.get('/groups/all', contacts_controller_1.contactsController.getGroups.bind(contacts_controller_1.contactsController));
router.post('/groups', (0, validate_1.validate)(contacts_schema_1.createContactGroupSchema), contacts_controller_1.contactsController.createGroup.bind(contacts_controller_1.contactsController));
router.get('/groups/:groupId', contacts_controller_1.contactsController.getGroupById.bind(contacts_controller_1.contactsController));
router.patch('/groups/:groupId', (0, validate_1.validate)(contacts_schema_1.updateContactGroupSchema), contacts_controller_1.contactsController.updateGroup.bind(contacts_controller_1.contactsController));
router.delete('/groups/:groupId', contacts_controller_1.contactsController.deleteGroup.bind(contacts_controller_1.contactsController));
router.get('/groups/:groupId/contacts', contacts_controller_1.contactsController.getGroupContacts.bind(contacts_controller_1.contactsController));
router.post('/groups/:groupId/contacts', (0, validate_1.validate)(contacts_schema_1.addContactsToGroupSchema), contacts_controller_1.contactsController.addContactsToGroup.bind(contacts_controller_1.contactsController));
router.delete('/groups/:groupId/contacts', (0, validate_1.validate)(contacts_schema_1.addContactsToGroupSchema), contacts_controller_1.contactsController.removeContactsFromGroup.bind(contacts_controller_1.contactsController));
// ============================================
// LIST / CREATE / IMPORT / BULK
// ============================================
router.get('/', contacts_controller_1.contactsController.getList.bind(contacts_controller_1.contactsController));
router.post('/', (0, validate_1.validate)(contacts_schema_1.createContactSchema), planLimits_1.checkContactLimit, contacts_controller_1.contactsController.create.bind(contacts_controller_1.contactsController));
// ✅ Import contacts (NOW supports JSON + Array + CSV file)
router.post('/import', contacts_import_middleware_1.contactsImportMiddleware, // converts array/file into {contacts:[]}
planLimits_1.checkContactLimit, // ✅ ADD THIS
(0, validate_1.validate)(contacts_schema_1.importContactsSchema), // validates normalized body
contacts_controller_1.contactsController.import.bind(contacts_controller_1.contactsController));
router.patch('/bulk', (0, validate_1.validate)(contacts_schema_1.bulkUpdateSchema), contacts_controller_1.contactsController.bulkUpdate.bind(contacts_controller_1.contactsController));
router.delete('/bulk', (0, validate_1.validate)(contacts_schema_1.bulkDeleteSchema), contacts_controller_1.contactsController.bulkDelete.bind(contacts_controller_1.contactsController));
// ============================================
// CONTACT BY ID (LAST)
// ============================================
router.get('/:id', contacts_controller_1.contactsController.getById.bind(contacts_controller_1.contactsController));
router.patch('/:id', (0, validate_1.validate)(contacts_schema_1.updateContactSchema), contacts_controller_1.contactsController.update.bind(contacts_controller_1.contactsController));
router.delete('/:id', contacts_controller_1.contactsController.delete.bind(contacts_controller_1.contactsController));
exports.default = router;
//# sourceMappingURL=contacts.routes.js.map