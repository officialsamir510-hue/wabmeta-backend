// src/modules/webhooks/webhook.routes.ts - COMPLETE FIX

import { Router, Request, Response } from 'express';
import { webhookService } from './webhook.service';

const router = Router();

console.log('📦 Webhook routes module loaded');

/**
 * GET /api/webhooks/meta
 * Webhook verification endpoint (for Meta setup)
 */
router.get('/meta', (req: Request, res: Response) => {
  console.log('📞 GET /api/webhooks/meta - Verification request');

  const mode = req.query['hub.mode'] as string;
  const token = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'] as string;

  console.log('Verification params:', { mode, token: token ? 'present' : 'missing', challenge: challenge ? 'present' : 'missing' });

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
  console.log('📥 POST /api/webhooks/meta - Webhook received');

  try {
    // Respond immediately to Meta (required within 5 seconds)
    res.status(200).send('EVENT_RECEIVED');

    console.log('📨 Processing webhook payload...');

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
 * Legacy /verify route (backward compatibility)
 */
router.get('/verify', (req: Request, res: Response) => {
  console.log('⚠️ GET /api/webhooks/verify called (legacy route)');

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

/**
 * Test route to verify webhook router is loaded
 */
router.get('/test', (req: Request, res: Response) => {
  console.log('✅ Webhook test route hit');
  res.json({
    success: true,
    message: 'Webhook routes are working',
    timestamp: new Date().toISOString(),
  });
});

console.log('✅ Webhook routes configured');

export default router;