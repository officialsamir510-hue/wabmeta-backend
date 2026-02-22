// src/modules/webhooks/webhook.routes.ts - FIXED

import { Router, Request, Response } from 'express';
import { webhookService } from './webhook.service';

const router = Router();

/**
 * GET /api/webhooks/meta
 * Webhook verification endpoint (for Meta setup)
 */
router.get('/meta', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'] as string;
  const token = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'] as string;

  console.log('📞 Webhook verification request:', { mode, token });

  const result = webhookService.verifyWebhook(mode, token, challenge);

  if (result) {
    console.log('✅ Webhook verified, sending challenge:', result);
    res.status(200).send(result);
  } else {
    console.error('❌ Webhook verification failed');
    res.status(403).send('Forbidden');
  }
});

/**
 * POST /api/webhooks/meta
 * Receive WhatsApp webhooks
 */
router.post('/meta', async (req: Request, res: Response) => {
  try {
    console.log('📥 Webhook POST received');
    console.log('Body:', JSON.stringify(req.body, null, 2));

    // Respond immediately to Meta (required within 5 seconds)
    res.status(200).send('EVENT_RECEIVED');

    // Process webhook asynchronously
    const result = await webhookService.handleWebhook(req.body);

    // Log webhook
    await webhookService.logWebhook(
      req.body,
      result.status,
      result.error || result.reason
    );

    console.log('✅ Webhook processed:', result);
  } catch (error: any) {
    console.error('❌ Webhook error:', error);

    // Log error
    try {
      await webhookService.logWebhook(
        req.body,
        'failed',
        error.message
      );
    } catch (logError) {
      console.error('Failed to log webhook error:', logError);
    }
  }
});

/**
 * Legacy route support (if needed)
 */
router.get('/verify', (req: Request, res: Response) => {
  console.log('⚠️ /verify called - redirecting to /meta');
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

export default router;