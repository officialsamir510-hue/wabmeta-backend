// src/modules/meta/meta.routes.ts

import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import * as metaController from './meta.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Connect Meta account
router.post('/connect', metaController.connectMeta);

// Get connection status
router.get('/status', metaController.getConnectionStatus);

// Refresh connection
router.post('/refresh', metaController.refreshConnection);

// Disconnect
router.post('/disconnect', metaController.disconnect);

export default router;