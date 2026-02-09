import { Router } from 'express';
import { WhatsAppController } from './whatsapp.controller'; // Ensure this matches export
import { authenticate } from '../../middleware/auth'; // Fixed path

const router = Router();

router.use(authenticate);

// Ensure binding is correct
router.get('/accounts', WhatsAppController.getAccounts.bind(WhatsAppController));
router.post('/connect', WhatsAppController.connectAccount.bind(WhatsAppController));
router.delete('/accounts/:id', WhatsAppController.connectAccount.bind(WhatsAppController));
router.post('/accounts/:id/default', WhatsAppController.setDefaultAccount.bind(WhatsAppController));

export default router;