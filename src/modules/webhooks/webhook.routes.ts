// 📁 src/modules/webhooks/webhook.routes.ts - COMPLETE

import { Router, Request, Response } from 'express';
import { webhookService } from './webhook.service';

const router = Router();

// ============================================
// WEBHOOK VERIFICATION (GET)
// ============================================
router.get('/', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'] as string;
  const token = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'] as string;

  const result = webhookService.verifyWebhook(mode, token, challenge);

  if (result) {
    res.status(200).send(result);
  } else {
    res.sendStatus(403);
  }
});

// ============================================
// WEBHOOK HANDLER (POST)
// ============================================
router.post('/', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-hub-signature-256'] as string | undefined;

    // ✅ IMPORTANT: Respond immediately to Meta
    // Meta expects 200 OK within 20 seconds
    res.sendStatus(200);

    // Process webhook asynchronously
    setImmediate(async () => {
      try {
        await webhookService.processWebhook(req.body, signature);
      } catch (error) {
        console.error('❌ Async webhook processing error:', error);
      }
    });
  } catch (error) {
    console.error('❌ Webhook handler error:', error);
    // Still send 200 to prevent Meta from retrying
    if (!res.headersSent) {
      res.sendStatus(200);
    }
  }
});

// ============================================
// WEBHOOK LOGS (Admin)
// ============================================
router.get('/logs', async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 50, status, eventType } = req.query;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (eventType) {
      where.eventType = eventType;
    }

    const [logs, total] = await Promise.all([
      prisma.webhookLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        select: {
          id: true,
          source: true,
          eventType: true,
          status: true,
          processedAt: true,
          responseTime: true,
          errorMessage: true,
          createdAt: true,
        },
      }),
      prisma.webhookLog.count({ where }),
    ]);

    res.json({
      success: true,
      data: logs,
      meta: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error('❌ Error fetching webhook logs:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch logs' });
  }
});

// ============================================
// MANUAL WINDOW EXPIRY (Cron job endpoint)
// ============================================
router.post('/expire-windows', async (req: Request, res: Response) => {
  try {
    const count = await webhookService.expireConversationWindows();
    res.json({ success: true, expired: count });
  } catch (error) {
    console.error('❌ Error expiring windows:', error);
    res.status(500).json({ success: false, message: 'Failed to expire windows' });
  }
});

// ============================================
// MANUAL LIMIT RESET (Cron job endpoint)
// ============================================
router.post('/reset-limits', async (req: Request, res: Response) => {
  try {
    const count = await webhookService.resetDailyMessageLimits();
    res.json({ success: true, reset: count });
  } catch (error) {
    console.error('❌ Error resetting limits:', error);
    res.status(500).json({ success: false, message: 'Failed to reset limits' });
  }
});

// Import prisma
import prisma from '../../config/database';

export default router;