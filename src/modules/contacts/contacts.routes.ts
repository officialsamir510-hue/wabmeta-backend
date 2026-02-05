// src/modules/contacts/contacts.routes.ts

import { Router } from 'express';
import { contactsController } from './contacts.controller';
import { validate } from '../../middleware/validate';
import { authenticate, requireOrganization } from '../../middleware/auth';
import {
  createContactSchema,
  updateContactSchema,
  getContactsSchema,
  getContactByIdSchema,
  deleteContactSchema,
  importContactsSchema,
  bulkUpdateContactsSchema,
  bulkDeleteContactsSchema,
  createContactGroupSchema,
  updateContactGroupSchema,
  addContactsToGroupSchema,
  removeContactsFromGroupSchema,
  deleteContactGroupSchema,
} from './contacts.schema';

const router: Router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// CONTACTS ROUTES
// ============================================

/**
 * @route   POST /api/v1/contacts
 * @desc    Create new contact
 * @access  Private
 */
router.post(
  '/',
  validate(createContactSchema),
  contactsController.create.bind(contactsController)
);

/**
 * @route   GET /api/v1/contacts
 * @desc    Get contacts list with pagination
 * @access  Private
 */
router.get(
  '/',
  validate(getContactsSchema),
  contactsController.getList.bind(contactsController)
);

/**
 * @route   GET /api/v1/contacts/stats
 * @desc    Get contact statistics
 * @access  Private
 */
router.get('/stats', contactsController.getStats.bind(contactsController));

/**
 * @route   GET /api/v1/contacts/tags
 * @desc    Get all tags with counts
 * @access  Private
 */
router.get('/tags', contactsController.getTags.bind(contactsController));

/**
 * @route   GET /api/v1/contacts/export
 * @desc    Export contacts as CSV
 * @access  Private
 */
router.get('/export', contactsController.export.bind(contactsController));

/**
 * @route   POST /api/v1/contacts/import
 * @desc    Import contacts from JSON/CSV data
 * @access  Private
 */
router.post(
  '/import',
  validate(importContactsSchema),
  contactsController.import.bind(contactsController)
);

/**
 * @route   PUT /api/v1/contacts/bulk
 * @desc    Bulk update contacts
 * @access  Private
 */
router.put(
  '/bulk',
  validate(bulkUpdateContactsSchema),
  contactsController.bulkUpdate.bind(contactsController)
);

/**
 * @route   DELETE /api/v1/contacts/bulk
 * @desc    Bulk delete contacts
 * @access  Private
 */
router.delete(
  '/bulk',
  validate(bulkDeleteContactsSchema),
  contactsController.bulkDelete.bind(contactsController)
);

/**
 * @route   GET /api/v1/contacts/:id
 * @desc    Get contact by ID
 * @access  Private
 */
router.get(
  '/:id',
  validate(getContactByIdSchema),
  contactsController.getById.bind(contactsController)
);

/**
 * @route   PUT /api/v1/contacts/:id
 * @desc    Update contact
 * @access  Private
 */
router.put(
  '/:id',
  validate(updateContactSchema),
  contactsController.update.bind(contactsController)
);

/**
 * @route   DELETE /api/v1/contacts/:id
 * @desc    Delete contact
 * @access  Private
 */
router.delete(
  '/:id',
  validate(deleteContactSchema),
  contactsController.delete.bind(contactsController)
);

// ============================================
// CONTACT GROUPS ROUTES
// ============================================

/**
 * @route   POST /api/v1/contacts/groups
 * @desc    Create contact group
 * @access  Private
 */
router.post(
  '/groups',
  validate(createContactGroupSchema),
  contactsController.createGroup.bind(contactsController)
);

/**
 * @route   GET /api/v1/contacts/groups
 * @desc    Get all contact groups
 * @access  Private
 */
router.get('/groups', contactsController.getGroups.bind(contactsController));

/**
 * @route   GET /api/v1/contacts/groups/:groupId
 * @desc    Get contact group by ID
 * @access  Private
 */
router.get(
  '/groups/:groupId',
  contactsController.getGroupById.bind(contactsController)
);

/**
 * @route   PUT /api/v1/contacts/groups/:groupId
 * @desc    Update contact group
 * @access  Private
 */
router.put(
  '/groups/:groupId',
  validate(updateContactGroupSchema),
  contactsController.updateGroup.bind(contactsController)
);

/**
 * @route   DELETE /api/v1/contacts/groups/:groupId
 * @desc    Delete contact group
 * @access  Private
 */
router.delete(
  '/groups/:groupId',
  validate(deleteContactGroupSchema),
  contactsController.deleteGroup.bind(contactsController)
);

/**
 * @route   GET /api/v1/contacts/groups/:groupId/contacts
 * @desc    Get contacts in a group
 * @access  Private
 */
router.get(
  '/groups/:groupId/contacts',
  contactsController.getGroupContacts.bind(contactsController)
);

/**
 * @route   POST /api/v1/contacts/groups/:groupId/contacts
 * @desc    Add contacts to group
 * @access  Private
 */
router.post(
  '/groups/:groupId/contacts',
  validate(addContactsToGroupSchema),
  contactsController.addContactsToGroup.bind(contactsController)
);

/**
 * @route   DELETE /api/v1/contacts/groups/:groupId/contacts
 * @desc    Remove contacts from group
 * @access  Private
 */
router.delete(
  '/groups/:groupId/contacts',
  validate(removeContactsFromGroupSchema),
  contactsController.removeContactsFromGroup.bind(contactsController)
);

export default router;