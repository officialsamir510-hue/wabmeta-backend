// src/modules/inbox/inbox.routes.ts

import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { inboxService } from './inbox.service';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Get conversations
router.get('/conversations', async (req: any, res, next) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization context required' });
    }

    const { accountId, filter, search, page, limit } = req.query;

    const result = await inboxService.getConversations(organizationId, accountId as string, {
      filter: filter as 'all' | 'unread' | 'archived' | 'open' | undefined,
      search: search as string | undefined,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Get messages for a conversation
router.get('/conversations/:conversationId/messages', async (req: any, res, next) => {
  try {
    const { conversationId } = req.params;
    const { before, limit } = req.query;

    const result = await inboxService.getMessages(conversationId, {
      before: before as string | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Mark as read
router.post('/conversations/:conversationId/read', async (req: any, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user?.id;

    const result = await inboxService.markAsRead(conversationId, userId);

    return res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Archive conversation
router.post('/conversations/:conversationId/archive', async (req: any, res, next) => {
  try {
    const { conversationId } = req.params;
    const { isArchived } = req.body;

    const result = await inboxService.updateArchiveStatus(
      conversationId,
      isArchived !== undefined ? isArchived : true
    );

    return res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Archive conversation (dedicated endpoint)
router.put('/conversations/:conversationId/archive', async (req: any, res, next) => {
  try {
    const { conversationId } = req.params;

    const result = await inboxService.updateArchiveStatus(conversationId, true);

    return res.json({ success: true, data: result, message: 'Conversation archived' });
  } catch (error) {
    next(error);
  }
});

// Unarchive conversation
router.put('/conversations/:conversationId/unarchive', async (req: any, res, next) => {
  try {
    const { conversationId } = req.params;

    const result = await inboxService.updateArchiveStatus(conversationId, false);

    return res.json({ success: true, data: result, message: 'Conversation unarchived' });
  } catch (error) {
    next(error);
  }
});

// Update labels
router.put('/conversations/:conversationId/labels', async (req: any, res, next) => {
  try {
    const { conversationId } = req.params;
    const { labels } = req.body;

    const result = await inboxService.updateLabels(conversationId, labels || []);

    return res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Assign conversation
router.put('/conversations/:conversationId/assign', async (req: any, res, next) => {
  try {
    const { conversationId } = req.params;
    const { userId } = req.body;

    const result = await inboxService.assignConversation(conversationId, userId || null);

    return res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Get single conversation
router.get('/conversations/:conversationId', async (req: any, res, next) => {
  try {
    const organizationId = req.user?.organizationId;
    const { conversationId } = req.params;

    const conversation = await inboxService.getConversation(conversationId, organizationId);

    return res.json({ success: true, data: conversation });
  } catch (error) {
    next(error);
  }
});

// Get stats
router.get('/stats', async (req: any, res, next) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization context required' });
    }

    const { accountId } = req.query;

    const stats = await inboxService.getStats(organizationId, accountId as string);

    return res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
});

// Get all labels
router.get('/labels', async (req: any, res, next) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization context required' });
    }

    const labels = await inboxService.getAllLabels(organizationId);

    return res.json({ success: true, data: labels });
  } catch (error) {
    next(error);
  }
});

// Send message
router.post('/conversations/:conversationId/messages', async (req: any, res, next) => {
  try {
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id;
    const { conversationId } = req.params;

    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization context required' });
    }

    const message = await inboxService.sendMessage(organizationId, userId, conversationId, req.body);

    return res.json({ success: true, data: message, message: 'Message sent' });
  } catch (error) {
    next(error);
  }
});

// Start conversation with contact
router.post('/start', async (req: any, res, next) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization context required' });
    }

    const { contactId } = req.body;

    const conversation = await inboxService.getOrCreateConversation(organizationId, contactId);

    return res.json({ success: true, data: conversation });
  } catch (error) {
    next(error);
  }
});

export default router;