import { Router } from 'express';
import { WhatsappController } from './whatsapp.controller';
import { authenticate } from '../../middleware/auth'; // ✅ Correct path (auth.ts)

const whatsappController = new WhatsappController();

const router = Router();

router.use(authenticate);

router.get('/accounts', whatsappController.getAccounts.bind(whatsappController));
router.post('/connect', whatsappController.connectAccount.bind(whatsappController));
router.delete('/accounts/:id', whatsappController.disconnectAccount.bind(whatsappController));
router.post('/accounts/:id/default', whatsappController.setDefaultAccount.bind(whatsappController));

// Messaging routes (agar controller me defined hain)
// router.post('/send/text', whatsappController.sendText.bind(whatsappController)); 
// (Ensure these methods exist in controller before uncommenting)

export default router;