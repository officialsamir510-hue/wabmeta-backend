// src/app.ts

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { config } from './config';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { sendSuccess, sendError } from './utils/response';
import { prisma } from './lib/prisma';

// Import Webhook Service for Meta webhooks
import { WebhookService } from './modules/webhooks/webhook.service';

// ============================================
// IMPORT ROUTES
// ============================================
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/users/users.routes';
import organizationRoutes from './modules/organizations/organizations.routes';
import contactsRoutes from './modules/contacts/contacts.routes';
import templatesRoutes from './modules/templates/templates.routes';
import campaignsRoutes from './modules/campaigns/campaigns.routes';
import whatsappRoutes from './modules/whatsapp/whatsapp.routes';
import inboxRoutes from './modules/inbox/inbox.routes';
import chatbotRoutes from './modules/chatbot/chatbot.routes';
import automationRoutes from './modules/automation/automation.routes';
import adminRoutes from './modules/admin/admin.routes';
import billingRoutes from './modules/billing/billing.routes';
import metaRoutes from './modules/meta/meta.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import webhookRoutes from './modules/webhooks/webhook.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';
import apiKeyRoutes from './modules/api-keys/api-keys.routes';

// ============================================
// INITIALIZE EXPRESS APP
// ============================================
const app: Express = express();

// ============================================
// TRUST PROXY (Required for rate limiting behind reverse proxy)
// ============================================
app.set('trust proxy', 1);

// ============================================
// CORS CONFIGURATION
// ============================================
const allowedOrigins: string[] = [
  // Development
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  
  // Production
  'https://wabmeta.com',
  'https://www.wabmeta.com',
  'https://app.wabmeta.com',
];

// Add frontend URL from config if not already included
if (config.urls?.frontend && !allowedOrigins.includes(config.urls.frontend)) {
  allowedOrigins.push(config.urls.frontend);
}

// Add any additional origins from environment
if (config.security?.cors?.origins) {
  config.security.cors.origins.forEach((origin: string) => {
    if (!allowedOrigins.includes(origin)) {
      allowedOrigins.push(origin);
    }
  });
}

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if origin is allowed
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // In development, allow all origins
    if (config.app.isDevelopment) {
      console.log(`⚠️ CORS: Allowing non-whitelisted origin in dev: ${origin}`);
      return callback(null, true);
    }
    
    // In production, reject unknown origins
    console.warn(`❌ CORS: Blocked request from origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'X-Platform',
    'X-API-Key',
    'X-Organization-Id',
    'Cache-Control',
    'Pragma',
  ],
  exposedHeaders: [
    'Set-Cookie',
    'X-Total-Count',
    'X-Page',
    'X-Per-Page',
    'X-Total-Pages',
  ],
  maxAge: 86400, // 24 hours
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ============================================
// SECURITY MIDDLEWARE
// ============================================
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: config.app.isProduction ? undefined : false,
    hsts: config.app.isProduction ? {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    } : false,
  })
);

// ============================================
// RATE LIMITING
// ============================================

// General API rate limit
const apiLimiter = rateLimit({
  windowMs: config.security?.rateLimit?.api?.windowMs || 15 * 60 * 1000, // 15 minutes
  max: config.security?.rateLimit?.api?.max || 100,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/';
  },
});

// Strict rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: config.security?.rateLimit?.auth?.windowMs || 15 * 60 * 1000,
  max: config.security?.rateLimit?.auth?.max || 10,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Webhook rate limit (higher)
const webhookLimiter = rateLimit({
  windowMs: config.security?.rateLimit?.webhook?.windowMs || 60 * 1000, // 1 minute
  max: config.security?.rateLimit?.webhook?.max || 1000,
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================
// ⚡ WEBHOOK ROUTES (BEFORE JSON PARSING!)
// ============================================
// Meta webhooks require raw body for signature verification

// Meta Webhook Verification (GET)
app.get('/webhooks/meta', webhookLimiter, (req: Request, res: Response) => {
  const mode = req.query['hub.mode'] as string | undefined;
  const token = req.query['hub.verify_token'] as string | undefined;
  const challenge = req.query['hub.challenge'] as string | undefined;

  console.log('🔍 Meta Webhook Verification Request:', {
    mode,
    token: token ? `${token.substring(0, 10)}...` : 'undefined',
    hasChallenge: !!challenge,
    ip: req.ip,
  });

  // Verify the mode and token
  if (mode === 'subscribe' && token === config.meta.webhook.verifyToken) {
    console.log('✅ Meta Webhook Verified Successfully');
    return res.status(200).send(challenge);
  }

  console.error('❌ Meta Webhook Verification Failed:', {
    expectedToken: config.meta.webhook.verifyToken ? 'Set' : 'Not Set',
    receivedMode: mode,
  });

  return res.sendStatus(403);
});

// Meta Webhook Events (POST)
app.post(
  '/webhooks/meta',
  webhookLimiter,
  express.raw({ type: 'application/json', limit: '10mb' }),
  async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      const signature = req.headers['x-hub-signature-256'] as string | undefined;
      const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';

      // Log webhook receipt
      console.log('📩 Meta Webhook Received:', {
        hasSignature: !!signature,
        bodyLength: rawBody.length,
        ip: req.ip,
      });

      // Verify signature if configured
      if (config.meta.webhook.secret && signature) {
        const isValid = WebhookService.verifySignature(signature, rawBody);
        if (!isValid) {
          console.error('❌ Invalid Webhook Signature');
          return res.sendStatus(403);
        }
      } else if (config.app.isProduction && !signature) {
        console.warn('⚠️ Webhook received without signature in production');
      }

      // Parse JSON
      let payload: any;
      try {
        payload = rawBody ? JSON.parse(rawBody) : req.body;
      } catch (parseError) {
        console.error('❌ Webhook JSON Parse Error:', parseError);
        return res.sendStatus(400);
      }

      // IMPORTANT: Respond immediately to Meta (they expect quick response)
      res.sendStatus(200);

      // Process webhook asynchronously
      setImmediate(async () => {
        try {
          await WebhookService.processMetaWebhook(payload);
          console.log(`✅ Webhook processed in ${Date.now() - startTime}ms`);
        } catch (error) {
          console.error('❌ Async Webhook Processing Error:', error);
        }
      });

    } catch (error) {
      console.error('❌ Meta Webhook Error:', error);
      // Still return 200 to prevent Meta from retrying
      return res.sendStatus(200);
    }
  }
);

// Alternative webhook path (for flexibility)
app.get('/api/webhooks/meta', webhookLimiter, (req, res) => {
  res.redirect(307, '/webhooks/meta');
});

app.post('/api/webhooks/meta', webhookLimiter, express.raw({ type: 'application/json', limit: '10mb' }), (req, res) => {
  res.redirect(307, '/webhooks/meta');
});

// ============================================
// BODY PARSING MIDDLEWARE (After webhook routes!)
// ============================================
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ============================================
// LOGGING MIDDLEWARE
// ============================================
if (config.app.isDevelopment) {
  app.use(morgan('dev'));
} else {
  // Custom production format
  app.use(morgan(':remote-addr - :method :url :status :res[content-length] - :response-time ms'));
}

// Request logger (custom middleware)
if (config.app.isDevelopment) {
  app.use(requestLogger);
}

// ============================================
// HEALTH CHECK & STATUS ROUTES
// ============================================

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  sendSuccess(res, {
    name: config.app.name || 'WabMeta API',
    version: config.app.apiVersion,
    environment: config.app.env,
    timestamp: new Date().toISOString(),
  }, 'WabMeta API Server is running');
});

// Health check endpoint
app.get('/health', async (req: Request, res: Response) => {
  const healthcheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: config.app.env,
    uptime: Math.floor(process.uptime()),
    memory: {
      heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
      rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
    },
    services: {
      database: 'checking',
      redis: 'disabled',
    },
  };

  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    healthcheck.services.database = 'healthy';

    // Check Redis if configured
    if (config.redis?.enabled) {
      // Add Redis health check here
      healthcheck.services.redis = 'healthy';
    }

    res.status(200).json({
      success: true,
      data: healthcheck,
    });
  } catch (error) {
    healthcheck.status = 'unhealthy';
    healthcheck.services.database = 'unhealthy';
    
    res.status(503).json({
      success: false,
      data: healthcheck,
      message: 'Service unhealthy',
    });
  }
});

// Readiness probe (for Kubernetes)
app.get('/ready', async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ ready: true });
  } catch (error) {
    res.status(503).json({ ready: false });
  }
});

// Liveness probe (for Kubernetes)
app.get('/live', (req: Request, res: Response) => {
  res.status(200).json({ alive: true });
});

// ============================================
// DEBUG ROUTES (Development only)
// ============================================
if (config.app.isDevelopment) {
  // CORS debug
  app.get('/api/debug/cors', (req: Request, res: Response) => {
    res.json({
      success: true,
      message: 'CORS is working!',
      origin: req.headers.origin || 'No origin header',
      allowedOrigins,
      headers: {
        'access-control-allow-origin': res.getHeader('Access-Control-Allow-Origin'),
        'access-control-allow-credentials': res.getHeader('Access-Control-Allow-Credentials'),
      },
    });
  });

  // POST test
  app.post('/api/debug/echo', (req: Request, res: Response) => {
    res.json({
      success: true,
      message: 'Echo successful',
      body: req.body,
      headers: req.headers,
      query: req.query,
    });
  });

  // Config debug (sanitized)
  app.get('/api/debug/config', (req: Request, res: Response) => {
    res.json({
      success: true,
      config: {
        app: config.app,
        urls: config.urls,
        features: config.features,
        meta: {
          graphApiVersion: config.meta.graphApiVersion,
          redirectUri: config.meta.redirectUri,
          hasAppId: !!config.meta.appId,
          hasAppSecret: !!config.meta.appSecret,
          hasWebhookToken: !!config.meta.webhook.verifyToken,
        },
      },
    });
  });
}

// ============================================
// API ROUTES
// ============================================
const apiPrefix = `/api/${config.app.apiVersion}`;

// Apply general rate limiter to all API routes
app.use(apiPrefix, apiLimiter);

// Auth routes (with stricter rate limiting)
app.use(`${apiPrefix}/auth`, authLimiter, authRoutes);

// Core routes
app.use(`${apiPrefix}/users`, userRoutes);
app.use(`${apiPrefix}/organizations`, organizationRoutes);

// Feature routes
app.use(`${apiPrefix}/contacts`, contactsRoutes);
app.use(`${apiPrefix}/templates`, templatesRoutes);
app.use(`${apiPrefix}/campaigns`, campaignsRoutes);
app.use(`${apiPrefix}/whatsapp`, whatsappRoutes);
app.use(`${apiPrefix}/inbox`, inboxRoutes);
app.use(`${apiPrefix}/chatbot`, chatbotRoutes);
app.use(`${apiPrefix}/automation`, automationRoutes);
app.use(`${apiPrefix}/analytics`, analyticsRoutes);

// Integration routes
app.use(`${apiPrefix}/meta`, metaRoutes);
app.use(`${apiPrefix}/webhooks`, webhookRoutes);
app.use(`${apiPrefix}/api-keys`, apiKeyRoutes);

// Billing routes
app.use(`${apiPrefix}/billing`, billingRoutes);

// Admin routes
app.use(`${apiPrefix}/admin`, adminRoutes);

// Dashboard routes
app.use(`${apiPrefix}/dashboard`, dashboardRoutes);

// ============================================
// LEGACY ROUTE SUPPORT (Optional)
// ============================================
// Support routes without version prefix for backward compatibility
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/meta', metaRoutes);

// ============================================
// LOG REGISTERED ROUTES (Development)
// ============================================
if (config.app.isDevelopment) {
  console.log('\n📍 Registered API Routes:');
  console.log('─'.repeat(50));
  console.log('   Base Routes:');
  console.log('     GET  /');
  console.log('     GET  /health');
  console.log('     GET  /ready');
  console.log('     GET  /live');
  console.log('');
  console.log('   Webhook Routes:');
  console.log('     GET  /webhooks/meta');
  console.log('     POST /webhooks/meta');
  console.log('');
  console.log('   API Routes:');
  [
    'auth', 'users', 'organizations', 'contacts', 'templates',
    'campaigns', 'whatsapp', 'inbox', 'chatbot', 'automation',
    'analytics', 'meta', 'webhooks', 'api-keys', 'billing',
    'admin', 'dashboard'
  ].forEach(route => {
    console.log(`     ${apiPrefix}/${route}`);
  });
  console.log('');
  console.log('   Debug Routes:');
  console.log('     GET  /api/debug/cors');
  console.log('     POST /api/debug/echo');
  console.log('     GET  /api/debug/config');
  console.log('─'.repeat(50));
  console.log('');
}

// ============================================
// 404 HANDLER
// ============================================
app.use(notFoundHandler);

// ============================================
// ERROR HANDLER (Must be last!)
// ============================================
app.use(errorHandler);

// ============================================
// GRACEFUL SHUTDOWN
// ============================================
const gracefulShutdown = async (signal: string) => {
  console.log(`\n⚠️ Received ${signal}. Starting graceful shutdown...`);
  
  try {
    // Close database connection
    await prisma.$disconnect();
    console.log('✅ Database disconnected');
    
    // Close Redis connection if configured
    // await redis.quit();
    
    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ============================================
// UNHANDLED ERRORS
// ============================================
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit in development
  if (config.app.isProduction) {
    gracefulShutdown('unhandledRejection');
  }
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

export default app;