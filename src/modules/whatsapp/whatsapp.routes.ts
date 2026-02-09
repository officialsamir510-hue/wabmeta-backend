import { Router } from 'express';
import { whatsappController } from './whatsapp.controller'; // ✅ Use lowercase instance
import { authenticate } from '../../middleware/auth'; // ✅ Correct path (auth.ts)

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