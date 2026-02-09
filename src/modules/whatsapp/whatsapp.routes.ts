import { Router } from 'express';
import { whatsappController } from './whatsapp.controller'; // Import instance
import { authenticate } from '../../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/accounts', whatsappController.getAccounts.bind(whatsappController));
router.get('/accounts/:id', whatsappController.getAccount.bind(whatsappController));
router.post('/connect', whatsappController.connectAccount.bind(whatsappController)); // Notice name matches controller
router.delete('/accounts/:id', whatsappController.disconnectAccount.bind(whatsappController));
router.post('/accounts/:id/default', whatsappController.setDefaultAccount.bind(whatsappController));
router.post('/send/text', whatsappController.sendText.bind(whatsappController));
router.post('/send/template', whatsappController.sendTemplate.bind(whatsappController));

export default router;