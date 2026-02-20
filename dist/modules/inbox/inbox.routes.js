"use strict";
// src/modules/inbox/inbox.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middleware/auth");
const inbox_controller_1 = require("./inbox.controller");
const router = (0, express_1.Router)();
// ==========================================
// Apply authentication to all routes
// ==========================================
router.use(auth_1.authenticate);
// ==========================================
// CONVERSATIONS
// ==========================================
// GET /inbox/conversations - List all conversations
router.get('/conversations', (req, res, next) => inbox_controller_1.inboxController.getConversations(req, res, next));
// POST /inbox/conversations/start - Start new conversation
router.post('/conversations/start', (req, res, next) => inbox_controller_1.inboxController.startConversation(req, res, next));
// GET /inbox/conversations/:id - Get single conversation
router.get('/conversations/:id', (req, res, next) => inbox_controller_1.inboxController.getConversationById(req, res, next));
// PUT /inbox/conversations/:id - Update conversation
router.put('/conversations/:id', (req, res, next) => inbox_controller_1.inboxController.updateConversation(req, res, next));
// DELETE /inbox/conversations/:id - Delete conversation
router.delete('/conversations/:id', (req, res, next) => inbox_controller_1.inboxController.deleteConversation(req, res, next));
// ==========================================
// MARK AS READ - ✅ FIXED
// ==========================================
// POST /inbox/conversations/:id/read - Mark as read
router.post('/conversations/:id/read', (req, res, next) => inbox_controller_1.inboxController.markAsRead(req, res, next));
// Also support PUT and PATCH
router.put('/conversations/:id/read', (req, res, next) => inbox_controller_1.inboxController.markAsRead(req, res, next));
router.patch('/conversations/:id/read', (req, res, next) => inbox_controller_1.inboxController.markAsRead(req, res, next));
// ==========================================
// MESSAGES
// ==========================================
// GET /inbox/conversations/:id/messages - Get messages
router.get('/conversations/:id/messages', (req, res, next) => inbox_controller_1.inboxController.getMessages(req, res, next));
// POST /inbox/conversations/:id/messages - Send message
router.post('/conversations/:id/messages', (req, res, next) => inbox_controller_1.inboxController.sendMessage(req, res, next));
// ==========================================
// ARCHIVE
// ==========================================
// POST /inbox/conversations/:id/archive - Archive
router.post('/conversations/:id/archive', (req, res, next) => inbox_controller_1.inboxController.archiveConversation(req, res, next));
// POST /inbox/conversations/:id/unarchive - Unarchive
router.post('/conversations/:id/unarchive', (req, res, next) => inbox_controller_1.inboxController.unarchiveConversation(req, res, next));
// DELETE /inbox/conversations/:id/archive - Unarchive (alternative)
router.delete('/conversations/:id/archive', (req, res, next) => inbox_controller_1.inboxController.unarchiveConversation(req, res, next));
// ==========================================
// ASSIGNMENT
// ==========================================
// POST /inbox/conversations/:id/assign - Assign to user
router.post('/conversations/:id/assign', (req, res, next) => inbox_controller_1.inboxController.assignConversation(req, res, next));
// ==========================================
// LABELS
// ==========================================
// GET /inbox/labels - Get all labels
router.get('/labels', (req, res, next) => inbox_controller_1.inboxController.getLabels(req, res, next));
// POST /inbox/conversations/:id/labels - Add labels
router.post('/conversations/:id/labels', (req, res, next) => inbox_controller_1.inboxController.addLabels(req, res, next));
// DELETE /inbox/conversations/:id/labels/:label - Remove label
router.delete('/conversations/:id/labels/:label', (req, res, next) => inbox_controller_1.inboxController.removeLabel(req, res, next));
// ==========================================
// BULK OPERATIONS
// ==========================================
// POST /inbox/bulk - Bulk update
router.post('/bulk', (req, res, next) => inbox_controller_1.inboxController.bulkUpdate(req, res, next));
// ==========================================
// SEARCH & STATS
// ==========================================
// GET /inbox/search - Search messages
router.get('/search', (req, res, next) => inbox_controller_1.inboxController.searchMessages(req, res, next));
// GET /inbox/stats - Get inbox stats
router.get('/stats', (req, res, next) => inbox_controller_1.inboxController.getStats(req, res, next));
exports.default = router;
//# sourceMappingURL=inbox.routes.js.map