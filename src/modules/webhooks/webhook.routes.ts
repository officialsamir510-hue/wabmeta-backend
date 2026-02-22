// src/modules/webhooks/webhook.routes.ts

import { Router, Request, Response } from 'express';
import { webhookService } from './webhook.service';

const router = Router();

/**
 * GET /api/webhooks/verify
 * Webhook verification endpoint (for Meta setup)
 */
router.get('/verify', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'] as string;
  const token = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'] as string;

  console.log('📞 Webhook verification request:', { mode, token });

  const result = webhookService.verifyWebhook(mode, token, challenge);

  if (result) {
    res.status(200).send(result);
  } else {
    res.status(403).send('Forbidden');
  }
});

/**
 * POST /api/webhooks
 * Receive WhatsApp webhooks
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // Respond immediately to Meta (required)
    res.status(200).send('EVENT_RECEIVED');

    // Process webhook asynchronously
    const result = await webhookService.handleWebhook(req.body);

    // Log webhook
    await webhookService.logWebhook(
      req.body,
      result.status,
      result.error || result.reason
    );

    console.log('Webhook processed:', result);
  } catch (error: any) {
    console.error('Webhook error:', error);

    // Log error
    await webhookService.logWebhook(
      req.body,
      'failed',
      error.message
    );
  }
});

export default router;