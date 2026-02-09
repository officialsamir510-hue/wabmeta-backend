import { Router } from 'express';
import { whatsappController } from './whatsapp.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/accounts', whatsappController.getAccounts.bind(whatsappController));
router.post('/connect', whatsappController.connectAccount.bind(whatsappController));
router.delete('/accounts/:id', whatsappController.disconnectAccount.bind(whatsappController));
router.post('/accounts/:id/default', whatsappController.setDefaultAccount.bind(whatsappController));

export default router;