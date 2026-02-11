// src/app.ts

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { config } from './config';

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
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5174',
      'https://wabmeta.com',
      'https://www.wabmeta.com',
      config.frontendUrl,
    ];

    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
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
      // Respond immediately to Meta
      res.sendStatus(200);

      // Process asynchronously
      const payload = JSON.parse(req.body.toString());
      
      // Import webhook service dynamically to avoid circular deps
      const { webhookService } = await import('./modules/webhooks/webhook.service');
      setImmediate(() => {
        webhookService.processWebhook(payload).catch(console.error);
      });
    } catch (error) {
      console.error('Webhook Error:', error);
      return res.sendStatus(200); // Still return 200 to prevent retries
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
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    // Check database
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$disconnect();

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
const apiPrefix = '/api';

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
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  console.error('Error:', {
    status,
    message,
    stack: config.nodeEnv === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  res.status(status).json({
    success: false,
    message,
    ...(config.nodeEnv === 'development' && { stack: err.stack }),
  });
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing server...');
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing server...');
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  await prisma.$disconnect();
  process.exit(0);
});

export default app;