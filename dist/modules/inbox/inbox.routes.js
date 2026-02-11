"use strict";
// src/modules/inbox/inbox.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middleware/auth");
const inbox_service_1 = require("./inbox.service");
const router = (0, express_1.Router)();
// Apply authentication to all routes
router.use(auth_1.authenticate);
// Get conversations
router.get('/conversations', async (req, res, next) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) {
            return res.status(400).json({ success: false, message: 'Organization context required' });
        }
        const { accountId, filter, search, page, limit } = req.query;
        const result = await inbox_service_1.inboxService.getConversations(organizationId, accountId, {
            filter: filter,
            search: search,
            page: page ? parseInt(page) : undefined,
            limit: limit ? parseInt(limit) : undefined,
        });
        return res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
// Get messages for a conversation
router.get('/conversations/:conversationId/messages', async (req, res, next) => {
    try {
        const { conversationId } = req.params;
        const { before, limit } = req.query;
        const result = await inbox_service_1.inboxService.getMessages(conversationId, {
            before: before,
            limit: limit ? parseInt(limit) : undefined,
        });
        return res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
// Mark as read
router.post('/conversations/:conversationId/read', async (req, res, next) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user?.id;
        const result = await inbox_service_1.inboxService.markAsRead(conversationId, userId);
        return res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
// Archive conversation
router.post('/conversations/:conversationId/archive', async (req, res, next) => {
    try {
        const { conversationId } = req.params;
        const { isArchived } = req.body;
        const result = await inbox_service_1.inboxService.updateArchiveStatus(conversationId, isArchived !== undefined ? isArchived : true);
        return res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
// Archive conversation (dedicated endpoint)
router.put('/conversations/:conversationId/archive', async (req, res, next) => {
    try {
        const { conversationId } = req.params;
        const result = await inbox_service_1.inboxService.updateArchiveStatus(conversationId, true);
        return res.json({ success: true, data: result, message: 'Conversation archived' });
    }
    catch (error) {
        next(error);
    }
});
// Unarchive conversation
router.put('/conversations/:conversationId/unarchive', async (req, res, next) => {
    try {
        const { conversationId } = req.params;
        const result = await inbox_service_1.inboxService.updateArchiveStatus(conversationId, false);
        return res.json({ success: true, data: result, message: 'Conversation unarchived' });
    }
    catch (error) {
        next(error);
    }
});
// Update labels
router.put('/conversations/:conversationId/labels', async (req, res, next) => {
    try {
        const { conversationId } = req.params;
        const { labels } = req.body;
        const result = await inbox_service_1.inboxService.updateLabels(conversationId, labels || []);
        return res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
// Assign conversation
router.put('/conversations/:conversationId/assign', async (req, res, next) => {
    try {
        const { conversationId } = req.params;
        const { userId } = req.body;
        const result = await inbox_service_1.inboxService.assignConversation(conversationId, userId || null);
        return res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
// Get single conversation
router.get('/conversations/:conversationId', async (req, res, next) => {
    try {
        const organizationId = req.user?.organizationId;
        const { conversationId } = req.params;
        const conversation = await inbox_service_1.inboxService.getConversation(conversationId, organizationId);
        return res.json({ success: true, data: conversation });
    }
    catch (error) {
        next(error);
    }
});
// Get stats
router.get('/stats', async (req, res, next) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) {
            return res.status(400).json({ success: false, message: 'Organization context required' });
        }
        const { accountId } = req.query;
        const stats = await inbox_service_1.inboxService.getStats(organizationId, accountId);
        return res.json({ success: true, data: stats });
    }
    catch (error) {
        next(error);
    }
});
// Get all labels
router.get('/labels', async (req, res, next) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) {
            return res.status(400).json({ success: false, message: 'Organization context required' });
        }
        const labels = await inbox_service_1.inboxService.getAllLabels(organizationId);
        return res.json({ success: true, data: labels });
    }
    catch (error) {
        next(error);
    }
});
// Send message
router.post('/conversations/:conversationId/messages', async (req, res, next) => {
    try {
        const organizationId = req.user?.organizationId;
        const userId = req.user?.id;
        const { conversationId } = req.params;
        if (!organizationId) {
            return res.status(400).json({ success: false, message: 'Organization context required' });
        }
        const message = await inbox_service_1.inboxService.sendMessage(organizationId, userId, conversationId, req.body);
        return res.json({ success: true, data: message, message: 'Message sent' });
    }
    catch (error) {
        next(error);
    }
});
// Start conversation with contact
router.post('/start', async (req, res, next) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId) {
            return res.status(400).json({ success: false, message: 'Organization context required' });
        }
        const { contactId } = req.body;
        const conversation = await inbox_service_1.inboxService.getOrCreateConversation(organizationId, contactId);
        return res.json({ success: true, data: conversation });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=inbox.routes.js.map