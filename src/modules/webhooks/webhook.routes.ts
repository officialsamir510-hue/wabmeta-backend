// src/modules/webhooks/webhook.routes.ts

import { Router, Request, Response } from 'express';
import { webhookService } from './webhook.service';

const router = Router();

// Webhook verification (GET)
router.get('/', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'] as string;
  const token = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'] as string;

  const result = webhookService.verifyWebhook(mode, token, challenge);

  if (result) {
    res.status(200).send(result);
  } else {
    res.status(403).send('Forbidden');
  }
});

// Webhook receiver (POST)
router.post('/', async (req: Request, res: Response) => {
  try {
    // Always respond 200 immediately to acknowledge receipt
    res.status(200).send('OK');

    // Process webhook asynchronously
    await webhookService.processWebhook(req.body);
  } catch (error) {
    console.error('[Webhook] Error:', error);
    // Still return 200 to prevent retries
    res.status(200).send('OK');
  }
});

export default router;