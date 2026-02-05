// src/modules/whatsapp/whatsapp.routes.ts

import { Router } from 'express';
import { whatsappController } from './whatsapp.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import {
  connectAccountSchema,
  disconnectAccountSchema,
  setDefaultAccountSchema,
  sendTextMessageSchema,
  sendTemplateMessageSchema,
  sendMediaMessageSchema,
  sendInteractiveMessageSchema,
  getMediaUrlSchema,
  syncTemplatesSchema,
} from './whatsapp.schema';

const router = Router();

// ============================================
// WEBHOOK ROUTES (No Auth - Called by Meta)
// ============================================

/**
 * @route   GET /api/v1/whatsapp/webhook
 * @desc    Webhook verification (Meta)
 * @access  Public
 */
router.get('/webhook', whatsappController.verifyWebhook.bind(whatsappController));

/**
 * @route   POST /api/v1/whatsapp/webhook
 * @desc    Webhook handler (Meta)
 * @access  Public
 */
router.post('/webhook', whatsappController.handleWebhook.bind(whatsappController));

// ============================================
// AUTHENTICATED ROUTES
// ============================================

// Apply authentication middleware to all routes below
router.use(authenticate);

// ============================================
// ACCOUNT MANAGEMENT
// ============================================

/**
 * @route   POST /api/v1/whatsapp/connect
 * @desc    Connect WhatsApp account via OAuth
 * @access  Private
 */
router.post(
  '/connect',
  validate(connectAccountSchema),
  whatsappController.connectAccount.bind(whatsappController)
);

/**
 * @route   GET /api/v1/whatsapp/accounts
 * @desc    Get all connected accounts
 * @access  Private
 */
router.get('/accounts', whatsappController.getAccounts.bind(whatsappController));

/**
 * @route   GET /api/v1/whatsapp/accounts/:id
 * @desc    Get account by ID
 * @access  Private
 */
router.get('/accounts/:id', whatsappController.getAccountById.bind(whatsappController));

/**
 * @route   POST /api/v1/whatsapp/accounts/:id/default
 * @desc    Set account as default
 * @access  Private
 */
router.post(
  '/accounts/:id/default',
  validate(setDefaultAccountSchema),
  whatsappController.setDefaultAccount.bind(whatsappController)
);

/**
 * @route   DELETE /api/v1/whatsapp/accounts/:id
 * @desc    Disconnect WhatsApp account
 * @access  Private
 */
router.delete(
  '/accounts/:id',
  validate(disconnectAccountSchema),
  whatsappController.disconnectAccount.bind(whatsappController)
);

// ============================================
// MESSAGING
// ============================================

/**
 * @route   POST /api/v1/whatsapp/send/text
 * @desc    Send text message
 * @access  Private
 */
router.post(
  '/send/text',
  validate(sendTextMessageSchema),
  whatsappController.sendTextMessage.bind(whatsappController)
);

/**
 * @route   POST /api/v1/whatsapp/send/template
 * @desc    Send template message
 * @access  Private
 */
router.post(
  '/send/template',
  validate(sendTemplateMessageSchema),
  whatsappController.sendTemplateMessage.bind(whatsappController)
);

/**
 * @route   POST /api/v1/whatsapp/send/media
 * @desc    Send media message (image/video/audio/document)
 * @access  Private
 */
router.post(
  '/send/media',
  validate(sendMediaMessageSchema),
  whatsappController.sendMediaMessage.bind(whatsappController)
);

/**
 * @route   POST /api/v1/whatsapp/send/interactive
 * @desc    Send interactive message (buttons/list)
 * @access  Private
 */
router.post(
  '/send/interactive',
  validate(sendInteractiveMessageSchema),
  whatsappController.sendInteractiveMessage.bind(whatsappController)
);

// ============================================
// TEMPLATES
// ============================================

/**
 * @route   POST /api/v1/whatsapp/templates/sync
 * @desc    Sync templates from Meta
 * @access  Private
 */
router.post(
  '/templates/sync',
  validate(syncTemplatesSchema),
  whatsappController.syncTemplates.bind(whatsappController)
);

// ============================================
// MEDIA
// ============================================

/**
 * @route   GET /api/v1/whatsapp/media/:mediaId
 * @desc    Get media URL
 * @access  Private
 */
router.get(
  '/media/:mediaId',
  validate(getMediaUrlSchema),
  whatsappController.getMediaUrl.bind(whatsappController)
);

export default router;