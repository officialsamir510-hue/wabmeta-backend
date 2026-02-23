// src/modules/chatbot/chatbot.routes.ts

import { Router } from 'express';
import { chatbotController } from './chatbot.controller';
import { authenticate } from '../../middleware/auth';
import { checkChatbotLimit } from '../../middleware/planLimits';

const router = Router();

// All routes require authentication
router.use(authenticate);

// CRUD routes
router.get('/', chatbotController.getAll.bind(chatbotController));
router.post('/', checkChatbotLimit, chatbotController.create.bind(chatbotController));
router.get('/:id', chatbotController.getById.bind(chatbotController));
router.put('/:id', chatbotController.update.bind(chatbotController));
router.delete('/:id', chatbotController.delete.bind(chatbotController));

// Action routes
router.post('/:id/activate', chatbotController.activate.bind(chatbotController));
router.post('/:id/deactivate', chatbotController.deactivate.bind(chatbotController));
router.post('/:id/duplicate', chatbotController.duplicate.bind(chatbotController));

// Stats
router.get('/:id/stats', chatbotController.getStats.bind(chatbotController));

export default router;