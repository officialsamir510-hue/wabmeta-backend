// src/modules/inbox/inbox.routes.ts

import { Router } from 'express';
import { inboxService } from './inbox.service';
import { authenticate } from '../../middleware/auth';
import { successResponse, errorResponse } from '../../utils/response';

const router = Router();

router.use(authenticate);

// Get conversations
router.get('/organizations/:organizationId/accounts/:accountId/conversations', async (req, res, next) => {
  try {
    const { organizationId, accountId } = req.params;
    const { filter, search, page, limit } = req.query;

    const result = await inboxService.getConversations(organizationId, accountId, {
      filter: filter as 'all' | 'unread' | 'archived' | 'open' | undefined,
      search: search as string,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    return successResponse(res, { data: result });
  } catch (error) {
    next(error);
  }
});

// Get messages
router.get('/conversations/:conversationId/messages', async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { before, limit } = req.query;

    const result = await inboxService.getMessages(conversationId, {
      before: before as string,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    return successResponse(res, { data: result });
  } catch (error) {
    next(error);
  }
});

// Mark as read
router.post('/conversations/:conversationId/read', async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const result = await inboxService.markAsRead(conversationId, req.user!.id);
    return successResponse(res, { data: result });
  } catch (error) {
    next(error);
  }
});

// Update archive status (replaces updateStatus)
router.patch('/conversations/:conversationId/status', async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { status } = req.body;
    
    // Map status to isArchived boolean
    const isArchived = status === 'archived' || status === 'closed';
    const result = await inboxService.updateArchiveStatus(conversationId, isArchived);
    
    return successResponse(res, { data: { conversation: result } });
  } catch (error) {
    next(error);
  }
});

// Archive conversation
router.post('/conversations/:conversationId/archive', async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const result = await inboxService.updateArchiveStatus(conversationId, true);
    return successResponse(res, { data: { conversation: result } });
  } catch (error) {
    next(error);
  }
});

// Unarchive conversation
router.post('/conversations/:conversationId/unarchive', async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const result = await inboxService.updateArchiveStatus(conversationId, false);
    return successResponse(res, { data: { conversation: result } });
  } catch (error) {
    next(error);
  }
});

// Update labels
router.patch('/conversations/:conversationId/labels', async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { labels } = req.body;
    const result = await inboxService.updateLabels(conversationId, labels || []);
    return successResponse(res, { data: { conversation: result } });
  } catch (error) {
    next(error);
  }
});

// Assign conversation
router.post('/conversations/:conversationId/assign', async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { userId } = req.body;
    const result = await inboxService.assignConversation(conversationId, userId);
    return successResponse(res, { data: { conversation: result } });
  } catch (error) {
    next(error);
  }
});

// Get stats
router.get('/organizations/:organizationId/accounts/:accountId/stats', async (req, res, next) => {
  try {
    const { organizationId, accountId } = req.params;
    const stats = await inboxService.getStats(organizationId, accountId);
    return successResponse(res, { data: stats });
  } catch (error) {
    next(error);
  }
});

// Get single conversation
router.get('/conversations/:conversationId', async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { organizationId } = req.query;
    
    if (!organizationId) {
      return errorResponse(res, 'Organization ID is required', 400);
    }
    
    const conversation = await inboxService.getConversation(
      conversationId, 
      organizationId as string
    );
    return successResponse(res, { data: { conversation } });
  } catch (error) {
    next(error);
  }
});

export default router;