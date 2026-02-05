// src/modules/inbox/inbox.routes.ts

import { Router } from 'express';
import { inboxController } from './inbox.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import {
  getConversationsSchema,
  getConversationByIdSchema,
  getMessagesSchema,
  sendMessageSchema,
  updateConversationSchema,
  markAsReadSchema,
  archiveConversationSchema,
  assignConversationSchema,
  addLabelsSchema,
  deleteConversationSchema,
  bulkUpdateConversationsSchema,
  searchMessagesSchema,
} from './inbox.schema';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// INBOX ROUTES
// ============================================

/**
 * @route   GET /api/v1/inbox/conversations
 * @desc    Get conversations list
 * @access  Private
 */
router.get(
  '/conversations',
  validate(getConversationsSchema),
  inboxController.getConversations.bind(inboxController)
);

/**
 * @route   GET /api/v1/inbox/stats
 * @desc    Get inbox statistics
 * @access  Private
 */
router.get('/stats', inboxController.getStats.bind(inboxController));

/**
 * @route   GET /api/v1/inbox/labels
 * @desc    Get all labels
 * @access  Private
 */
router.get('/labels', inboxController.getLabels.bind(inboxController));

/**
 * @route   GET /api/v1/inbox/search
 * @desc    Search messages
 * @access  Private
 */
router.get(
  '/search',
  validate(searchMessagesSchema),
  inboxController.searchMessages.bind(inboxController)
);

/**
 * @route   POST /api/v1/inbox/conversations
 * @desc    Start new conversation with contact
 * @access  Private
 */
router.post('/conversations', inboxController.startConversation.bind(inboxController));

/**
 * @route   PUT /api/v1/inbox/conversations/bulk
 * @desc    Bulk update conversations
 * @access  Private
 */
router.put(
  '/conversations/bulk',
  validate(bulkUpdateConversationsSchema),
  inboxController.bulkUpdate.bind(inboxController)
);

/**
 * @route   GET /api/v1/inbox/conversations/:id
 * @desc    Get conversation by ID
 * @access  Private
 */
router.get(
  '/conversations/:id',
  validate(getConversationByIdSchema),
  inboxController.getConversationById.bind(inboxController)
);

/**
 * @route   PUT /api/v1/inbox/conversations/:id
 * @desc    Update conversation
 * @access  Private
 */
router.put(
  '/conversations/:id',
  validate(updateConversationSchema),
  inboxController.updateConversation.bind(inboxController)
);

/**
 * @route   DELETE /api/v1/inbox/conversations/:id
 * @desc    Delete conversation
 * @access  Private
 */
router.delete(
  '/conversations/:id',
  validate(deleteConversationSchema),
  inboxController.deleteConversation.bind(inboxController)
);

/**
 * @route   GET /api/v1/inbox/conversations/:id/messages
 * @desc    Get messages in conversation
 * @access  Private
 */
router.get(
  '/conversations/:id/messages',
  validate(getMessagesSchema),
  inboxController.getMessages.bind(inboxController)
);

/**
 * @route   POST /api/v1/inbox/conversations/:id/messages
 * @desc    Send message in conversation
 * @access  Private
 */
router.post(
  '/conversations/:id/messages',
  validate(sendMessageSchema),
  inboxController.sendMessage.bind(inboxController)
);

/**
 * @route   POST /api/v1/inbox/conversations/:id/read
 * @desc    Mark conversation as read
 * @access  Private
 */
router.post(
  '/conversations/:id/read',
  validate(markAsReadSchema),
  inboxController.markAsRead.bind(inboxController)
);

/**
 * @route   POST /api/v1/inbox/conversations/:id/archive
 * @desc    Archive conversation
 * @access  Private
 */
router.post(
  '/conversations/:id/archive',
  validate(archiveConversationSchema),
  inboxController.archiveConversation.bind(inboxController)
);

/**
 * @route   POST /api/v1/inbox/conversations/:id/unarchive
 * @desc    Unarchive conversation
 * @access  Private
 */
router.post(
  '/conversations/:id/unarchive',
  validate(archiveConversationSchema),
  inboxController.unarchiveConversation.bind(inboxController)
);

/**
 * @route   POST /api/v1/inbox/conversations/:id/assign
 * @desc    Assign conversation to user
 * @access  Private
 */
router.post(
  '/conversations/:id/assign',
  validate(assignConversationSchema),
  inboxController.assignConversation.bind(inboxController)
);

/**
 * @route   POST /api/v1/inbox/conversations/:id/labels
 * @desc    Add labels to conversation
 * @access  Private
 */
router.post(
  '/conversations/:id/labels',
  validate(addLabelsSchema),
  inboxController.addLabels.bind(inboxController)
);

/**
 * @route   DELETE /api/v1/inbox/conversations/:id/labels/:label
 * @desc    Remove label from conversation
 * @access  Private
 */
router.delete(
  '/conversations/:id/labels/:label',
  inboxController.removeLabel.bind(inboxController)
);

export default router;