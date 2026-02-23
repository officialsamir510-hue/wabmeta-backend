// src/modules/contacts/contacts.routes.ts - COMPLETE FIXED

import { Router } from 'express';
import multer from 'multer';
import { contactsController } from './contacts.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { checkContactLimit } from '../../middleware/planLimits';
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

import { contactsImportMiddleware } from './contacts.import.middleware';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// All routes require authentication
router.use(authenticate);

// ============================================
// CONTACT ROUTES (STATIC FIRST)
// ============================================

router.get('/stats', contactsController.getStats.bind(contactsController));
router.get('/tags', contactsController.getTags.bind(contactsController));
router.get('/export', contactsController.export.bind(contactsController));

router.post('/refresh-profiles/batch', contactsController.refreshUnknownNames.bind(contactsController));
router.post('/refresh-names', contactsController.refreshUnknownNames.bind(contactsController));

// ============================================
// CONTACT GROUP ROUTES (MUST BE BEFORE /:id)
// ============================================

router.get('/groups/all', contactsController.getGroups.bind(contactsController));

router.post('/groups', validate(createContactGroupSchema), contactsController.createGroup.bind(contactsController));
router.get('/groups/:groupId', contactsController.getGroupById.bind(contactsController));

router.patch('/groups/:groupId', validate(updateContactGroupSchema), contactsController.updateGroup.bind(contactsController));
router.delete('/groups/:groupId', contactsController.deleteGroup.bind(contactsController));

router.get('/groups/:groupId/contacts', contactsController.getGroupContacts.bind(contactsController));

router.post(
  '/groups/:groupId/contacts',
  validate(addContactsToGroupSchema),
  contactsController.addContactsToGroup.bind(contactsController)
);

router.delete(
  '/groups/:groupId/contacts',
  validate(addContactsToGroupSchema),
  contactsController.removeContactsFromGroup.bind(contactsController)
);

// ============================================
// LIST / CREATE / IMPORT / BULK
// ============================================

router.get('/', contactsController.getList.bind(contactsController));
router.post('/', validate(createContactSchema), checkContactLimit, contactsController.create.bind(contactsController));

// ✅ Import contacts (NOW supports JSON + Array + CSV file)
router.post(
  '/import',
  contactsImportMiddleware,       // converts array/file into {contacts:[]}
  checkContactLimit,              // ✅ ADD THIS
  validate(importContactsSchema), // validates normalized body
  contactsController.import.bind(contactsController)
);

router.patch('/bulk', validate(bulkUpdateSchema), contactsController.bulkUpdate.bind(contactsController));
router.delete('/bulk', validate(bulkDeleteSchema), contactsController.bulkDelete.bind(contactsController));

// ============================================
// CONTACT BY ID (LAST)
// ============================================

router.get('/:id', contactsController.getById.bind(contactsController));

router.patch('/:id', validate(updateContactSchema), contactsController.update.bind(contactsController));
router.delete('/:id', contactsController.delete.bind(contactsController));

export default router;