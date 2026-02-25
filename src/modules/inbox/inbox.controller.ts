// src/modules/inbox/inbox.controller.ts - COMPLETE (existing + labels/pin/media)

import { Request, Response, NextFunction } from 'express';
import { inboxService } from './inbox.service';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../middleware/errorHandler';
import {
  ConversationsQueryInput,
  MessagesQueryInput,
  SendMessageInput,
  UpdateConversationInput,
} from './inbox.types';

import prisma from '../../config/database';
import whatsappService from '../whatsapp/whatsapp.service';

// Extended Request interface
interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    organizationId?: string;
  };
  file?: any;
}

export class InboxController {
  // ==========================================
  // GET CONVERSATIONS
  // ==========================================
  async getConversations(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const query: ConversationsQueryInput = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        search: req.query.search as string,
        isArchived: req.query.isArchived === 'true',
        isRead:
          req.query.isRead === 'true'
            ? true
            : req.query.isRead === 'false'
              ? false
              : undefined,
        assignedTo: req.query.assignedTo as string,
        labels: req.query.labels ? (req.query.labels as string).split(',') : undefined,
        sortBy: (req.query.sortBy as any) || 'lastMessageAt',
        sortOrder: (req.query.sortOrder as any) || 'desc',
      };

      const result = await inboxService.getConversations(organizationId, query);
      return res.json({
        success: true,
        message: 'Conversations fetched successfully',
        data: result.conversations,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET CONVERSATION BY ID
  // ==========================================
  async getConversationById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const { id } = req.params as { id: string };
      const conversation = await inboxService.getConversationById(organizationId, id);
      return sendSuccess(res, conversation, 'Conversation fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET MESSAGES
  // ==========================================
  async getMessages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const { id } = req.params as { id: string };
      const query: MessagesQueryInput = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 50,
        before: req.query.before as string,
        after: req.query.after as string,
      };

      const result = await inboxService.getMessages(organizationId, id, query);
      return sendSuccess(res, result, 'Messages fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // SEND MESSAGE (existing)
  // ==========================================
  async sendMessage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const { id } = req.params as { id: string };
      const { content } = req.body;

      if (!content) {
        throw new AppError('Message content is required', 400);
      }

      // 1. Get Conversation detail to get contact phone
      const conversation = await inboxService.getConversationById(organizationId, id);

      // 2. Get Default WA Account
      const account = await whatsappService.getDefaultAccount(organizationId);
      if (!account?.id) {
        throw new AppError('No connected WhatsApp account found', 400);
      }

      // 3. Send via WhatsApp Service- using generic sendMessage for consistency
      const result = await whatsappService.sendMessage({
        accountId: account.id,
        to: conversation.contact.phone,
        type: 'text',
        content: { text: { body: content } },
        conversationId: id,
        organizationId: organizationId
      });

      // 4. Clear Inbox Cache
      await inboxService.clearCache(organizationId);

      return sendSuccess(res, result.message, 'Message sent successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // MARK AS READ
  // ==========================================
  async markAsRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const { id } = req.params as { id: string };
      const conversation = await inboxService.markAsRead(organizationId, id);
      return sendSuccess(res, conversation, 'Marked as read');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // ARCHIVE / UNARCHIVE
  // ==========================================
  async archiveConversation(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const { id } = req.params as { id: string };
      const conversation = await inboxService.archiveConversation(organizationId, id, true);
      return sendSuccess(res, conversation, 'Conversation archived');
    } catch (error) {
      next(error);
    }
  }

  async unarchiveConversation(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const { id } = req.params as { id: string };
      const conversation = await inboxService.archiveConversation(organizationId, id, false);
      return sendSuccess(res, conversation, 'Conversation unarchived');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // ASSIGN CONVERSATION
  // ==========================================
  async assignConversation(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const { id } = req.params as { id: string };
      const { userId } = req.body;
      const conversation = await inboxService.assignConversation(organizationId, id, userId);
      return sendSuccess(res, conversation, 'Conversation assigned');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // UPDATE CONVERSATION
  // ==========================================
  async updateConversation(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const { id } = req.params as { id: string };
      const input: UpdateConversationInput = req.body;
      const conversation = await inboxService.updateConversation(organizationId, id, input);
      return sendSuccess(res, conversation, 'Conversation updated');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // ADD LABELS
  // ==========================================
  async addLabels(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const { id } = req.params as { id: string };
      const { labels } = req.body;

      if (!Array.isArray(labels)) {
        throw new AppError('labels must be an array', 400);
      }

      const conversation = await inboxService.addLabels(organizationId, id, labels);
      return sendSuccess(res, conversation, 'Labels added');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // REMOVE LABEL
  // ==========================================
  async removeLabel(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const { id, label } = req.params as { id: string; label: string };
      const conversation = await inboxService.removeLabel(organizationId, id, label);
      return sendSuccess(res, conversation, 'Label removed');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // DELETE CONVERSATION
  // ==========================================
  async deleteConversation(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const { id } = req.params as { id: string };
      const result = await inboxService.deleteConversation(organizationId, id);
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // BULK UPDATE
  // ==========================================
  async bulkUpdate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const { conversationIds, ...updates } = req.body;
      const result = await inboxService.bulkUpdate(organizationId, conversationIds, updates);
      return sendSuccess(res, result, `${result.updated} conversations updated`);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // SEARCH MESSAGES
  // ==========================================
  async searchMessages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const query = req.query.q as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await inboxService.searchMessages(organizationId, query, page, limit);
      return sendSuccess(res, result, 'Search completed');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET STATS
  // ==========================================
  async getStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const stats = await inboxService.getStats(organizationId);
      return sendSuccess(res, stats, 'Stats fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET LABELS
  // ==========================================
  async getLabels(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const labels = await inboxService.getAllLabels(organizationId);
      return sendSuccess(res, labels, 'Labels fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // START CONVERSATION WITH CONTACT
  // ==========================================
  async startConversation(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const { contactId } = req.body;
      const conversation = await inboxService.getOrCreateConversation(organizationId, contactId);
      return sendSuccess(res, conversation, 'Conversation ready');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // ✅ NEW: PIN/UNPIN CONVERSATION
  // PATCH /inbox/conversations/:id/pin
  // body: { isPinned: boolean }
  // ==========================================
  async togglePin(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const { id } = req.params as { id: string };
      const { isPinned } = req.body as { isPinned: boolean };

      // Ensure conversation belongs to org
      await inboxService.getConversationById(organizationId, id);

      const updated = await prisma.conversation.update({
        where: { id },
        data: { isPinned: Boolean(isPinned) }, // IDE: restart TS server if this shows an error
      });

      return sendSuccess(res, updated, Boolean(isPinned) ? 'Conversation pinned' : 'Conversation unpinned');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // ✅ NEW: UPLOAD MEDIA
  // POST /inbox/media/upload (multipart form-data: file)
  // ==========================================
  async uploadMedia(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      if (!req.file) throw new AppError('File is required', 400);

      const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'https') as string;
      const host = req.get('host');

      const url = `${proto}://${host}/uploads/media/${req.file.filename}`;

      const mime = req.file.mimetype || '';
      const mediaType =
        mime.startsWith('image/') ? 'image'
          : mime.startsWith('video/') ? 'video'
            : mime.startsWith('audio/') ? 'audio'
              : 'document';

      return sendSuccess(
        res,
        {
          url,
          mediaType,
          mimeType: mime,
          filename: req.file.originalname,
          size: req.file.size,
        },
        'File uploaded',
        201
      );
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // ✅ NEW: SEND MEDIA MESSAGE
  // POST /inbox/conversations/:id/messages/media
  // body: { mediaType: "image|video|audio|document", mediaUrl: string, caption?: string }
  // ==========================================
  async sendMediaMessage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const { id } = req.params as { id: string };
      const { mediaType, mediaUrl, caption } = req.body as {
        mediaType: 'image' | 'video' | 'audio' | 'document';
        mediaUrl: string;
        caption?: string;
      };

      if (!mediaType || !mediaUrl) throw new AppError('mediaType and mediaUrl are required', 400);

      // Validate conversation
      const conversation = await inboxService.getConversationById(organizationId, id);

      // Use default WA account
      const account = await whatsappService.getDefaultAccount(organizationId);
      if (!account?.id) {
        throw new AppError('No WhatsApp account connected. Please connect WhatsApp first.', 400);
      }

      const result = await whatsappService.sendMediaMessage(
        account.id,
        conversation.contact.phone,
        mediaType,
        mediaUrl,
        caption,
        id,
        organizationId
      );

      // ✅ Clear Inbox Cache
      await inboxService.clearCache(organizationId);

      return sendSuccess(res, result, 'Media message sent successfully', 201);
    } catch (error) {
      next(error);
    }
  }
}

export const inboxController = new InboxController();