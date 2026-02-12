// src/app.ts

import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import { config } from './config';
import prisma from './config/database';
import { rateLimit, authRateLimit } from './middleware/rateLimit';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// ============================================
// IMPORT ROUTES (Only existing ones)
// ============================================
import authRoutes from './modules/auth/auth.routes';
import metaRoutes from './modules/meta/meta.routes';
import whatsappRoutes from './modules/whatsapp/whatsapp.routes';
import inboxRoutes from './modules/inbox/inbox.routes';
import contactsRoutes from './modules/contacts/contacts.routes';
import templatesRoutes from './modules/templates/templates.routes';
import campaignsRoutes from './modules/campaigns/campaigns.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import billingRoutes from './modules/billing/billing.routes';
import organizationsRoutes from './modules/organizations/organizations.routes';
import usersRoutes from './modules/users/users.routes';
import chatbotRoutes from './modules/chatbot/chatbot.routes';
import webhookRoutes from './modules/webhooks/webhook.routes';

// Initialize Express App
const app: Express = express();

// Trust proxy
app.set('trust proxy', 1);

// ============================================
// CORS CONFIGURATION
// ============================================
const normalizeOrigin = (o?: string | null) => (o || '').replace(/\/$/, '');
const allowedOrigins = Array.from(
  new Set((config.frontend?.corsOrigins || []).map(normalizeOrigin))
).filter(Boolean);

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    const normalized = normalizeOrigin(origin);
    if (allowedOrigins.includes(normalized)) {
      return callback(null, true);
    }

    // In development, allow all
    if (config.nodeEnv === 'development') {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Total-Pages'],
  maxAge: 86400,
};

app.use(cors(corsOptions));

// ============================================
// SECURITY MIDDLEWARE
// ============================================
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));

// ============================================
// WEBHOOK ROUTES (Before body parsing!)
// ============================================
// Meta Webhook Verification (GET)
app.get('/webhooks/meta', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'] as string;
  const token = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'] as string;

  console.log('Meta Webhook Verification:', { mode, hasToken: !!token });

  if (mode === 'subscribe' && token === (process.env.WEBHOOK_VERIFY_TOKEN || 'webhook-verify-token')) {
    console.log('✅ Webhook Verified');
    return res.status(200).send(challenge);
  }

  console.error('❌ Webhook Verification Failed');
  return res.sendStatus(403);
});

// Meta Webhook Events (POST) - Raw body for signature verification
app.post('/webhooks/meta',
  express.raw({ type: 'application/json', limit: '10mb' }),
  async (req: Request, res: Response) => {
    try {
      // Verify signature
      const signature = req.header('x-hub-signature-256') || '';
      const body = req.body as Buffer;
      const appSecret = config.meta.appSecret || process.env.META_APP_SECRET || '';

      if (!appSecret) {
        console.error('Webhook Error: META_APP_SECRET missing');
        return res.sendStatus(500);
      }

      const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(body).digest('hex');
      let valid = false;
      try {
        valid = signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
      } catch {
        valid = false;
      }

      if (!valid) {
        console.warn('Webhook Error: Invalid signature');
        return res.sendStatus(403);
      }

      // Acknowledge first
      res.sendStatus(200);

      // Process asynchronously
      const payload = JSON.parse(body.toString());
      const { webhookService } = await import('./modules/webhooks/webhook.service');
      setImmediate(() => {
        webhookService.processWebhook(payload).catch(console.error);
      });
    } catch (error) {
      console.error('Webhook Error:', error);
      return res.sendStatus(200); // Avoid retries on unexpected errors
    }
  }
);

// ============================================
// BODY PARSING MIDDLEWARE
// ============================================
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ============================================
// RATE LIMITING
// ============================================
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: config.rateLimit.max }));
app.use('/api/auth', authRateLimit);

// ============================================
// LOGGING MIDDLEWARE
// ============================================
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ============================================
// HEALTH CHECK ROUTES
// ============================================
app.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'WabMeta API Server',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', async (req: Request, res: Response) => {
  try {
    // Check database with shared prisma
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.nodeEnv,
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================
// API ROUTES
// ============================================
const apiPrefix = '/api/v1';

// Auth routes
app.use(`${apiPrefix}/auth`, authRoutes);

// Core routes
app.use(`${apiPrefix}/users`, usersRoutes);
app.use(`${apiPrefix}/organizations`, organizationsRoutes);

// Feature routes
app.use(`${apiPrefix}/contacts`, contactsRoutes);
app.use(`${apiPrefix}/templates`, templatesRoutes);
app.use(`${apiPrefix}/campaigns`, campaignsRoutes);
app.use(`${apiPrefix}/whatsapp`, whatsappRoutes);
app.use(`${apiPrefix}/inbox`, inboxRoutes);
app.use(`${apiPrefix}/chatbot`, chatbotRoutes);
app.use(`${apiPrefix}/dashboard`, dashboardRoutes);
app.use(`${apiPrefix}/billing`, billingRoutes);

// Integration routes
app.use(`${apiPrefix}/meta`, metaRoutes);
app.use(`${apiPrefix}/webhooks`, webhookRoutes);

// Admin routes (if exists)
try {
  const adminRoutes = require('./modules/admin/admin.routes').default;
  app.use(`${apiPrefix}/admin`, adminRoutes);
} catch (e) {
  // Admin module not implemented yet
}

// ============================================
// ERROR HANDLING
// ============================================

// 404 Handler
app.use(notFoundHandler);

// Global Error Handler
app.use(errorHandler);

export default app;
