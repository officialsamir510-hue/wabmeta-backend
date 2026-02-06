// src/modules/meta/meta.routes.ts

import { Router, Request, Response } from 'express';
import { MetaController } from './meta.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// OAuth Flow
router.get('/auth/url', (req: Request, res: Response) => {
  MetaController.getAuthUrl(req, res);
});

router.post('/auth/callback', (req: Request, res: Response) => {
  MetaController.handleCallback(req, res);
});

// Connection Management
router.get('/status', (req: Request, res: Response) => {
  MetaController.getConnectionStatus(req, res);
});

router.post('/disconnect', (req: Request, res: Response) => {
  MetaController.disconnect(req, res);
});

export default router;