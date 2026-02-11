// src/modules/whatsapp/whatsapp.routes.ts

import { Router } from 'express';
import { whatsappController } from './whatsapp.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { rateLimit } from '../../middleware/rateLimit';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Rate limit for sending messages
const sendRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 messages per minute
  message: 'Too many messages sent. Please wait a moment.',
});

// Send text message
router.post('/send/text', sendRateLimit, whatsappController.sendText.bind(whatsappController));

// Send template message
router.post(
  '/send/template',
  sendRateLimit,
  whatsappController.sendTemplate.bind(whatsappController)
);

// Send media message
router.post(
  '/send/media',
  sendRateLimit,
  whatsappController.sendMedia.bind(whatsappController)
);

// Mark message as read
router.post('/read', whatsappController.markAsRead.bind(whatsappController));

export default router;