"use strict";
// src/modules/inbox/inbox.controller.ts - COMPLETE (existing + labels/pin/media)
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.inboxController = exports.InboxController = void 0;
const inbox_service_1 = require("./inbox.service");
const response_1 = require("../../utils/response");
const errorHandler_1 = require("../../middleware/errorHandler");
const database_1 = __importDefault(require("../../config/database"));
const whatsapp_service_1 = __importDefault(require("../whatsapp/whatsapp.service"));
class InboxController {
    // ==========================================
    // GET CONVERSATIONS
    // ==========================================
    async getConversations(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const query = {
                page: parseInt(req.query.page) || 1,
                limit: parseInt(req.query.limit) || 20,
                search: req.query.search,
                isArchived: req.query.isArchived === 'true',
                isRead: req.query.isRead === 'true'
                    ? true
                    : req.query.isRead === 'false'
                        ? false
                        : undefined,
                assignedTo: req.query.assignedTo,
                labels: req.query.labels ? req.query.labels.split(',') : undefined,
                sortBy: req.query.sortBy || 'lastMessageAt',
                sortOrder: req.query.sortOrder || 'desc',
            };
            const result = await inbox_service_1.inboxService.getConversations(organizationId, query);
            return res.json({
                success: true,
                message: 'Conversations fetched successfully',
                data: result.conversations,
                meta: result.meta,
            });
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // GET CONVERSATION BY ID
    // ==========================================
    async getConversationById(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const { id } = req.params;
            const conversation = await inbox_service_1.inboxService.getConversationById(organizationId, id);
            return (0, response_1.sendSuccess)(res, conversation, 'Conversation fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // GET MESSAGES
    // ==========================================
    async getMessages(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const { id } = req.params;
            const query = {
                page: parseInt(req.query.page) || 1,
                limit: parseInt(req.query.limit) || 50,
                before: req.query.before,
                after: req.query.after,
            };
            const result = await inbox_service_1.inboxService.getMessages(organizationId, id, query);
            return (0, response_1.sendSuccess)(res, result, 'Messages fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // SEND MESSAGE (existing)
    // ==========================================
    async sendMessage(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                throw new errorHandler_1.AppError('Organization context required', 400);
            }
            const { id } = req.params;
            const { content, tempId, clientMsgId } = req.body;
            if (!content) {
                throw new errorHandler_1.AppError('Message content is required', 400);
            }
            // 1. Get Conversation detail to get contact phone
            const conversation = await inbox_service_1.inboxService.getConversationById(organizationId, id);
            // 2. Get Default WA Account
            const account = await whatsapp_service_1.default.getDefaultAccount(organizationId);
            if (!account?.id) {
                throw new errorHandler_1.AppError('No connected WhatsApp account found', 400);
            }
            // 3. Send via WhatsApp Service- using generic sendMessage for consistency
            const result = await whatsapp_service_1.default.sendMessage({
                accountId: account.id,
                to: conversation.contact.phone,
                type: 'text',
                content: { text: { body: content } },
                conversationId: id,
                organizationId: organizationId,
                tempId: tempId || req.body.localId || req.body.local_id || req.body._id,
                clientMsgId: clientMsgId || req.body.client_msg_id || req.body.clientMsgId
            });
            // 4. Clear Inbox Cache
            await inbox_service_1.inboxService.clearCache(organizationId);
            return (0, response_1.sendSuccess)(res, result.message, 'Message sent successfully', 201);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // MARK AS READ
    // ==========================================
    async markAsRead(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const { id } = req.params;
            const conversation = await inbox_service_1.inboxService.markAsRead(organizationId, id);
            return (0, response_1.sendSuccess)(res, conversation, 'Marked as read');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // ARCHIVE / UNARCHIVE
    // ==========================================
    async archiveConversation(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const { id } = req.params;
            const conversation = await inbox_service_1.inboxService.archiveConversation(organizationId, id, true);
            return (0, response_1.sendSuccess)(res, conversation, 'Conversation archived');
        }
        catch (error) {
            next(error);
        }
    }
    async unarchiveConversation(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const { id } = req.params;
            const conversation = await inbox_service_1.inboxService.archiveConversation(organizationId, id, false);
            return (0, response_1.sendSuccess)(res, conversation, 'Conversation unarchived');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // ASSIGN CONVERSATION
    // ==========================================
    async assignConversation(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const { id } = req.params;
            const { userId } = req.body;
            const conversation = await inbox_service_1.inboxService.assignConversation(organizationId, id, userId);
            return (0, response_1.sendSuccess)(res, conversation, 'Conversation assigned');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // UPDATE CONVERSATION
    // ==========================================
    async updateConversation(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const { id } = req.params;
            const input = req.body;
            const conversation = await inbox_service_1.inboxService.updateConversation(organizationId, id, input);
            return (0, response_1.sendSuccess)(res, conversation, 'Conversation updated');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // ADD LABELS
    // ==========================================
    async addLabels(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const { id } = req.params;
            const { labels } = req.body;
            if (!Array.isArray(labels)) {
                throw new errorHandler_1.AppError('labels must be an array', 400);
            }
            const conversation = await inbox_service_1.inboxService.addLabels(organizationId, id, labels);
            return (0, response_1.sendSuccess)(res, conversation, 'Labels added');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // REMOVE LABEL
    // ==========================================
    async removeLabel(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const { id, label } = req.params;
            const conversation = await inbox_service_1.inboxService.removeLabel(organizationId, id, label);
            return (0, response_1.sendSuccess)(res, conversation, 'Label removed');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // DELETE CONVERSATION
    // ==========================================
    async deleteConversation(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const { id } = req.params;
            const result = await inbox_service_1.inboxService.deleteConversation(organizationId, id);
            return (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // BULK UPDATE
    // ==========================================
    async bulkUpdate(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const { conversationIds, ...updates } = req.body;
            const result = await inbox_service_1.inboxService.bulkUpdate(organizationId, conversationIds, updates);
            return (0, response_1.sendSuccess)(res, result, `${result.updated} conversations updated`);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // SEARCH MESSAGES
    // ==========================================
    async searchMessages(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const query = req.query.q;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const result = await inbox_service_1.inboxService.searchMessages(organizationId, query, page, limit);
            return (0, response_1.sendSuccess)(res, result, 'Search completed');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // GET STATS
    // ==========================================
    async getStats(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const stats = await inbox_service_1.inboxService.getStats(organizationId);
            return (0, response_1.sendSuccess)(res, stats, 'Stats fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // GET LABELS
    // ==========================================
    async getLabels(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const labels = await inbox_service_1.inboxService.getAllLabels(organizationId);
            return (0, response_1.sendSuccess)(res, labels, 'Labels fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // START CONVERSATION WITH CONTACT
    // ==========================================
    async startConversation(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const { contactId } = req.body;
            const conversation = await inbox_service_1.inboxService.getOrCreateConversation(organizationId, contactId);
            return (0, response_1.sendSuccess)(res, conversation, 'Conversation ready');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // ✅ NEW: PIN/UNPIN CONVERSATION
    // PATCH /inbox/conversations/:id/pin
    // body: { isPinned: boolean }
    // ==========================================
    async togglePin(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const { id } = req.params;
            const { isPinned } = req.body;
            // Ensure conversation belongs to org
            await inbox_service_1.inboxService.getConversationById(organizationId, id);
            const updated = await database_1.default.conversation.update({
                where: { id },
                data: { isPinned: Boolean(isPinned) }, // IDE: restart TS server if this shows an error
            });
            return (0, response_1.sendSuccess)(res, updated, Boolean(isPinned) ? 'Conversation pinned' : 'Conversation unpinned');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // ✅ NEW: UPLOAD MEDIA
    // POST /inbox/media/upload (multipart form-data: file)
    // ==========================================
    async uploadMedia(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            if (!req.file)
                throw new errorHandler_1.AppError('File is required', 400);
            const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'https');
            const host = req.get('host');
            const url = `${proto}://${host}/uploads/media/${req.file.filename}`;
            const mime = req.file.mimetype || '';
            const mediaType = mime.startsWith('image/') ? 'image'
                : mime.startsWith('video/') ? 'video'
                    : mime.startsWith('audio/') ? 'audio'
                        : 'document';
            return (0, response_1.sendSuccess)(res, {
                url,
                mediaType,
                mimeType: mime,
                filename: req.file.originalname,
                size: req.file.size,
            }, 'File uploaded', 201);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // ✅ NEW: SEND MEDIA MESSAGE
    // POST /inbox/conversations/:id/messages/media
    // body: { mediaType: "image|video|audio|document", mediaUrl: string, caption?: string }
    // ==========================================
    async sendMediaMessage(req, res, next) {
        try {
            const organizationId = req.user.organizationId;
            if (!organizationId)
                throw new errorHandler_1.AppError('Organization context required', 400);
            const { id } = req.params;
            const { mediaType, mediaUrl, caption } = req.body;
            if (!mediaType || !mediaUrl)
                throw new errorHandler_1.AppError('mediaType and mediaUrl are required', 400);
            // Validate conversation
            const conversation = await inbox_service_1.inboxService.getConversationById(organizationId, id);
            // Use default WA account
            const account = await whatsapp_service_1.default.getDefaultAccount(organizationId);
            if (!account?.id) {
                throw new errorHandler_1.AppError('No WhatsApp account connected. Please connect WhatsApp first.', 400);
            }
            const result = await whatsapp_service_1.default.sendMediaMessage(account.id, conversation.contact.phone, mediaType, mediaUrl, caption, id, organizationId, req.body.tempId || req.body.localId || req.body.local_id || req.body._id, req.body.clientMsgId || req.body.client_msg_id || req.body.clientMsgId);
            // ✅ Clear Inbox Cache
            await inbox_service_1.inboxService.clearCache(organizationId);
            return (0, response_1.sendSuccess)(res, result, 'Media message sent successfully', 201);
        }
        catch (error) {
            next(error);
        }
    }
}
exports.InboxController = InboxController;
exports.inboxController = new InboxController();
//# sourceMappingURL=inbox.controller.js.map