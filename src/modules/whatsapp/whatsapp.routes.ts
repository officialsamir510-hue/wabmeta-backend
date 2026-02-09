import { Router } from 'express';
// ✅ Import the INSTANCE (lowercase w), NOT the Class
import { WhatsAppController, whatsappController } from './whatsapp.controller'; 
import { authenticate } from '../../middleware/auth';

const router = Router();

router.use(authenticate);

// ✅ Call static methods on the class
router.get('/accounts', WhatsAppController.getAccounts);
router.post('/connect', WhatsAppController.connectAccount);
router.delete('/accounts/:id', whatsappController.disconnectAccount.bind(whatsappController));
router.post('/accounts/:id/default', WhatsAppController.setDefaultAccount);

export default router;