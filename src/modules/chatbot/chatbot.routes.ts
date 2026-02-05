// src/modules/chatbot/chatbot.routes.ts

import { Router } from 'express';
import { chatbotController } from './chatbot.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import {
  createChatbotSchema,
  updateChatbotSchema,
  getChatbotsSchema,
  getChatbotByIdSchema,
  deleteChatbotSchema,
  duplicateChatbotSchema,
  activateChatbotSchema,
  testChatbotSchema,
  saveFlowSchema,
} from './chatbot.schema';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// CHATBOT ROUTES
// ============================================

/**
 * @route   POST /api/v1/chatbot
 * @desc    Create new chatbot
 * @access  Private
 */
router.post(
  '/',
  validate(createChatbotSchema),
  chatbotController.create.bind(chatbotController)
);

/**
 * @route   GET /api/v1/chatbot
 * @desc    Get chatbots list
 * @access  Private
 */
router.get(
  '/',
  validate(getChatbotsSchema),
  chatbotController.getList.bind(chatbotController)
);

/**
 * @route   GET /api/v1/chatbot/stats
 * @desc    Get chatbot statistics
 * @access  Private
 */
router.get('/stats', chatbotController.getStats.bind(chatbotController));

/**
 * @route   GET /api/v1/chatbot/:id
 * @desc    Get chatbot by ID
 * @access  Private
 */
router.get(
  '/:id',
  validate(getChatbotByIdSchema),
  chatbotController.getById.bind(chatbotController)
);

/**
 * @route   PUT /api/v1/chatbot/:id
 * @desc    Update chatbot
 * @access  Private
 */
router.put(
  '/:id',
  validate(updateChatbotSchema),
  chatbotController.update.bind(chatbotController)
);

/**
 * @route   DELETE /api/v1/chatbot/:id
 * @desc    Delete chatbot
 * @access  Private
 */
router.delete(
  '/:id',
  validate(deleteChatbotSchema),
  chatbotController.delete.bind(chatbotController)
);

/**
 * @route   POST /api/v1/chatbot/:id/duplicate
 * @desc    Duplicate chatbot
 * @access  Private
 */
router.post(
  '/:id/duplicate',
  validate(duplicateChatbotSchema),
  chatbotController.duplicate.bind(chatbotController)
);

/**
 * @route   POST /api/v1/chatbot/:id/activate
 * @desc    Activate chatbot
 * @access  Private
 */
router.post(
  '/:id/activate',
  validate(activateChatbotSchema),
  chatbotController.activate.bind(chatbotController)
);

/**
 * @route   POST /api/v1/chatbot/:id/pause
 * @desc    Pause chatbot
 * @access  Private
 */
router.post(
  '/:id/pause',
  validate(activateChatbotSchema),
  chatbotController.pause.bind(chatbotController)
);

/**
 * @route   PUT /api/v1/chatbot/:id/flow
 * @desc    Save chatbot flow
 * @access  Private
 */
router.put(
  '/:id/flow',
  validate(saveFlowSchema),
  chatbotController.saveFlow.bind(chatbotController)
);

/**
 * @route   POST /api/v1/chatbot/:id/test
 * @desc    Test chatbot with message
 * @access  Private
 */
router.post(
  '/:id/test',
  validate(testChatbotSchema),
  chatbotController.test.bind(chatbotController)
);

export default router;