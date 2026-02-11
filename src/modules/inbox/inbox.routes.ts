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
    const { status, search, page, limit } = req.query;

    const result = await inboxService.getConversations(organizationId, accountId, {
      status: status as any,
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

// Update status
router.patch('/conversations/:conversationId/status', async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { status } = req.body;
    const result = await inboxService.updateStatus(conversationId, status);
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

export default router;