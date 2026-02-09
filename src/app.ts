// src/app.ts

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';

import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { sendError } from './utils/response';

import { WebhookService } from './modules/webhooks/webhook.service';

// Import routes
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/users/users.routes';
import organizationRoutes from './modules/organizations/organizations.routes';
import contactsRoutes from './modules/contacts/contacts.routes';
import templatesRoutes from './modules/templates/templates.routes';
import campaignsRoutes from './modules/campaigns/campaigns.routes';
import whatsappRoutes from './modules/whatsapp/whatsapp.routes';
import inboxRoutes from './modules/inbox/inbox.routes';
import chatbotRoutes from './modules/chatbot/chatbot.routes';
import adminRoutes from './modules/admin/admin.routes';
import billingRoutes from './modules/billing/billing.routes';
import razorpayRoutes from './modules/billing/razorpay.routes';
import metaRoutes from './modules/meta/meta.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';


const app: Express = express();

// ============================================
// TRUST PROXY
// ============================================
app.set('trust proxy', 1);

// ============================================
// CORS CONFIGURATION
// ============================================
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'https://wabmeta.com',
  'https://www.wabmeta.com',
];

if (config.frontendUrl && !allowedOrigins.includes(config.frontendUrl)) {
  allowedOrigins.push(config.frontendUrl);
}

console.log('🌐 CORS Allowed Origins:', allowedOrigins);

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // server-to-server requests / curl / meta webhook => origin undefined
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) return callback(null, true);

    // NOTE: aapke current code me non-whitelisted origin ko bhi allow kiya ja raha tha.
    // Same behavior maintain kar raha hu to avoid breaking anything in production.
    console.log('⚠️ CORS request from non-whitelisted origin:', origin);
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'x-platform',
    'Cache-Control',
    'Pragma',
  ],
  exposedHeaders: ['set-cookie', 'Set-Cookie'],
  maxAge: 86400,
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
    contentSecurityPolicy: false,
  })
);

// ============================================
// ⚡ WEBHOOK ROUTES (Before JSON parsing!)
// ============================================

// Meta webhook verification (GET)
app.get('/webhooks/meta', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'] as string | undefined;
  const token = req.query['hub.verify_token'] as string | undefined;
  const challenge = req.query['hub.challenge'] as string | undefined;

  const tokenPreview = token ? token.slice(0, 10) + '...' : 'undefined';
  console.log('🔍 Meta webhook verification:', { mode, token: tokenPreview });

  if (mode === 'subscribe' && token === config.meta.webhookVerifyToken) {
    console.log('✅ Meta webhook verified');
    return res.status(200).send(challenge);
  }

  console.error('❌ Meta webhook verification failed');
  return res.sendStatus(403);
});

/**
 * Meta webhook events (POST)
 * IMPORTANT: Use express.raw() to capture raw body (signature verification needs it)
 */
app.post(
  '/webhooks/meta',
  express.raw({ type: 'application/json', limit: '10mb' }),
  async (req: Request, res: Response) => {
    try {
      const signature = req.headers['x-hub-signature-256'] as string | undefined;

      const rawBody = Buffer.isBuffer(req.body)
        ? (req.body as Buffer).toString('utf8')
        : '';

      // Verify signature (if header exists)
      if (signature && rawBody) {
        const valid = WebhookService.verifySignature(signature, rawBody);
        if (!valid) {
          console.error('❌ Invalid webhook signature');
          return res.sendStatus(403);
        }
      } else {
        // In some cases signature may not be present (testing)
        console.warn('⚠️ Webhook signature missing or raw body empty');
      }

      // Parse JSON
      let parsed: any = null;
      try {
        parsed = rawBody ? JSON.parse(rawBody) : req.body;
      } catch (e) {
        console.error('❌ Webhook JSON parse error');
        return res.sendStatus(400);
      }

      // Acknowledge immediately
      res.sendStatus(200);

      // Process async (don’t block)
      WebhookService.processMetaWebhook(parsed).catch((err) => {
        console.error('❌ Webhook async processing error:', err);
      });
    } catch (error) {
      console.error('❌ Meta webhook error:', error);
      // Meta expects 200 quickly; even on error we respond 200 to avoid retries storm
      return res.sendStatus(200);
    }
  }
);

// ============================================
// PARSING MIDDLEWARE (for normal API routes)
// ============================================
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Logging
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ============================================
// HEALTH CHECK & DEBUG ROUTES
// ============================================
app.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'WabMeta API Server',
    version: config.apiVersion,
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

app.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'WabMeta API is running',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    uptime: process.uptime(),
  });
});

app.get('/api/debug/cors', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'CORS is working!',
    origin: req.headers.origin || 'No origin header',
    allowedOrigins,
    frontendUrl: config.frontendUrl,
    headers: {
      'access-control-allow-origin': res.getHeader('Access-Control-Allow-Origin'),
      'access-control-allow-credentials': res.getHeader('Access-Control-Allow-Credentials'),
    },
  });
});

app.post('/api/debug/cors-test', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'POST request successful!',
    receivedData: req.body,
    origin: req.headers.origin,
  });
});

// ============================================
// API ROUTES
// ============================================
const apiPrefix = `/api/${config.apiVersion}`;

app.use(`${apiPrefix}/auth`, authRoutes);
app.use(`${apiPrefix}/users`, userRoutes);
app.use(`${apiPrefix}/organizations`, organizationRoutes);
app.use(`${apiPrefix}/contacts`, contactsRoutes);
app.use(`${apiPrefix}/templates`, templatesRoutes);
app.use(`${apiPrefix}/campaigns`, campaignsRoutes);
app.use(`${apiPrefix}/whatsapp`, whatsappRoutes);
app.use(`${apiPrefix}/inbox`, inboxRoutes);
app.use(`${apiPrefix}/chatbot`, chatbotRoutes);
app.use(`${apiPrefix}/admin`, adminRoutes);
app.use(`${apiPrefix}/billing`, billingRoutes);
app.use(`${apiPrefix}/billing/razorpay`, razorpayRoutes);
app.use(`${apiPrefix}/meta`, metaRoutes);
app.use(`${apiPrefix}/dashboard`, dashboardRoutes);

// ============================================
// 404 HANDLER
// ============================================
app.use((req: Request, res: Response) => {
  sendError(res, `Route ${req.method} ${req.url} not found`, 404);
});

// ============================================
// ERROR HANDLER
// ============================================
app.use(errorHandler);

export default app;