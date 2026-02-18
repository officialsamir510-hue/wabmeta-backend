// src/modules/inbox/inbox.routes.ts

import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { inboxController } from './inbox.controller';

const router = Router();

// ==========================================
// Apply authentication to all routes
// ==========================================
router.use(authenticate);

// ==========================================
// CONVERSATIONS
// ==========================================

// GET /inbox/conversations - List all conversations
router.get('/conversations', (req, res, next) =>
  inboxController.getConversations(req as any, res, next)
);

// POST /inbox/conversations/start - Start new conversation
router.post('/conversations/start', (req, res, next) =>
  inboxController.startConversation(req as any, res, next)
);

// GET /inbox/conversations/:id - Get single conversation
router.get('/conversations/:id', (req, res, next) =>
  inboxController.getConversationById(req as any, res, next)
);

// PUT /inbox/conversations/:id - Update conversation
router.put('/conversations/:id', (req, res, next) =>
  inboxController.updateConversation(req as any, res, next)
);

// DELETE /inbox/conversations/:id - Delete conversation
router.delete('/conversations/:id', (req, res, next) =>
  inboxController.deleteConversation(req as any, res, next)
);

// ==========================================
// MARK AS READ - ✅ FIXED
// ==========================================

// POST /inbox/conversations/:id/read - Mark as read
router.post('/conversations/:id/read', (req, res, next) =>
  inboxController.markAsRead(req as any, res, next)
);

// Also support PUT and PATCH
router.put('/conversations/:id/read', (req, res, next) =>
  inboxController.markAsRead(req as any, res, next)
);

router.patch('/conversations/:id/read', (req, res, next) =>
  inboxController.markAsRead(req as any, res, next)
);

// ==========================================
// MESSAGES
// ==========================================

// GET /inbox/conversations/:id/messages - Get messages
router.get('/conversations/:id/messages', (req, res, next) =>
  inboxController.getMessages(req as any, res, next)
);

// POST /inbox/conversations/:id/messages - Send message
router.post('/conversations/:id/messages', (req, res, next) =>
  inboxController.sendMessage(req as any, res, next)
);

// ==========================================
// ARCHIVE
// ==========================================

// POST /inbox/conversations/:id/archive - Archive
router.post('/conversations/:id/archive', (req, res, next) =>
  inboxController.archiveConversation(req as any, res, next)
);

// POST /inbox/conversations/:id/unarchive - Unarchive
router.post('/conversations/:id/unarchive', (req, res, next) =>
  inboxController.unarchiveConversation(req as any, res, next)
);

// DELETE /inbox/conversations/:id/archive - Unarchive (alternative)
router.delete('/conversations/:id/archive', (req, res, next) =>
  inboxController.unarchiveConversation(req as any, res, next)
);

// ==========================================
// ASSIGNMENT
// ==========================================

// POST /inbox/conversations/:id/assign - Assign to user
router.post('/conversations/:id/assign', (req, res, next) =>
  inboxController.assignConversation(req as any, res, next)
);

// ==========================================
// LABELS
// ==========================================

// GET /inbox/labels - Get all labels
router.get('/labels', (req, res, next) =>
  inboxController.getLabels(req as any, res, next)
);

// POST /inbox/conversations/:id/labels - Add labels
router.post('/conversations/:id/labels', (req, res, next) =>
  inboxController.addLabels(req as any, res, next)
);

// DELETE /inbox/conversations/:id/labels/:label - Remove label
router.delete('/conversations/:id/labels/:label', (req, res, next) =>
  inboxController.removeLabel(req as any, res, next)
);

// ==========================================
// BULK OPERATIONS
// ==========================================

// POST /inbox/bulk - Bulk update
router.post('/bulk', (req, res, next) =>
  inboxController.bulkUpdate(req as any, res, next)
);

// ==========================================
// SEARCH & STATS
// ==========================================

// GET /inbox/search - Search messages
router.get('/search', (req, res, next) =>
  inboxController.searchMessages(req as any, res, next)
);

// GET /inbox/stats - Get inbox stats
router.get('/stats', (req, res, next) =>
  inboxController.getStats(req as any, res, next)
);

export default router;