// src/modules/contacts/contacts.routes.ts

import { Router } from 'express';
import { contactsController } from './contacts.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createContactSchema,
  updateContactSchema,
  importContactsSchema,
  bulkUpdateSchema,
  bulkDeleteSchema,
  createContactGroupSchema,
  updateContactGroupSchema,
  addContactsToGroupSchema,
} from './contacts.schema';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// CONTACT ROUTES
// ============================================

// Get contact stats
router.get('/stats', contactsController.getStats.bind(contactsController));

// Get all tags
router.get('/tags', contactsController.getTags.bind(contactsController));

// Export contacts
router.get('/export', contactsController.export.bind(contactsController));

// Refresh unknown names (NEW)
router.post(
  '/refresh-names',
  contactsController.refreshUnknownNames.bind(contactsController)
);

// Get contacts list
router.get('/', contactsController.getList.bind(contactsController));

// Create contact
router.post(
  '/',
  validate(createContactSchema),
  contactsController.create.bind(contactsController)
);

// Import contacts
router.post(
  '/import',
  validate(importContactsSchema),
  contactsController.import.bind(contactsController)
);

// Bulk update
router.patch(
  '/bulk',
  validate(bulkUpdateSchema),
  contactsController.bulkUpdate.bind(contactsController)
);

// Bulk delete
router.delete(
  '/bulk',
  validate(bulkDeleteSchema),
  contactsController.bulkDelete.bind(contactsController)
);

// Get contact by ID
router.get('/:id', contactsController.getById.bind(contactsController));

// Update contact
router.patch(
  '/:id',
  validate(updateContactSchema),
  contactsController.update.bind(contactsController)
);

// Delete contact
router.delete('/:id', contactsController.delete.bind(contactsController));

// ============================================
// CONTACT GROUP ROUTES
// ============================================

// Get all groups
router.get('/groups/all', contactsController.getGroups.bind(contactsController));

// Create group
router.post(
  '/groups',
  validate(createContactGroupSchema),
  contactsController.createGroup.bind(contactsController)
);

// Get group by ID
router.get('/groups/:groupId', contactsController.getGroupById.bind(contactsController));

// Update group
router.patch(
  '/groups/:groupId',
  validate(updateContactGroupSchema),
  contactsController.updateGroup.bind(contactsController)
);

// Delete group
router.delete('/groups/:groupId', contactsController.deleteGroup.bind(contactsController));

// Get group contacts
router.get('/groups/:groupId/contacts', contactsController.getGroupContacts.bind(contactsController));

// Add contacts to group
router.post(
  '/groups/:groupId/contacts',
  validate(addContactsToGroupSchema),
  contactsController.addContactsToGroup.bind(contactsController)
);

// Remove contacts from group
router.delete(
  '/groups/:groupId/contacts',
  validate(addContactsToGroupSchema),
  contactsController.removeContactsFromGroup.bind(contactsController)
);

export default router;