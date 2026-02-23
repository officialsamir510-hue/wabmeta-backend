import { Router } from 'express';
import { whatsappController } from './whatsapp.controller';
import { authenticate } from '../../middleware/auth';
import { rateLimit } from '../../middleware/rateLimit';

const router = Router();

router.use(authenticate);

// ✅ Accounts APIs (Fix 404)
router.get('/accounts', whatsappController.getAccounts.bind(whatsappController));
router.get('/accounts/:accountId', whatsappController.getAccount.bind(whatsappController));
router.post('/accounts/:accountId/default', whatsappController.setDefaultAccount.bind(whatsappController));
router.delete('/accounts/:accountId', whatsappController.disconnectAccount.bind(whatsappController));

// Rate limit for sending messages
const sendRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Too many messages sent. Please wait a moment.',
});

router.post('/send/text', sendRateLimit, whatsappController.sendText.bind(whatsappController));
// Send template message
router.post('/send/template', authenticate, whatsappController.sendTemplate);
router.post('/send/media', sendRateLimit, whatsappController.sendMedia.bind(whatsappController));
router.post('/read', whatsappController.markAsRead.bind(whatsappController));

export default router;