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
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
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

  console.log('🔍 Meta webhook verification:', { 
    mode, 
    token: token ? token.slice(0, 10) + '...' : 'undefined' 
  });

  if (mode === 'subscribe' && token === config.meta.webhookVerifyToken) {
    console.log('✅ Meta webhook verified');
    return res.status(200).send(challenge);
  }

  console.error('❌ Meta webhook verification failed');
  return res.sendStatus(403);
});

// Meta webhook events (POST)
app.post(
  '/webhooks/meta',
  express.raw({ type: 'application/json', limit: '10mb' }),
  async (req: Request, res: Response) => {
    try {
      const signature = req.headers['x-hub-signature-256'] as string | undefined;
      const rawBody = Buffer.isBuffer(req.body) ? (req.body as Buffer).toString('utf8') : '';

      if (signature && rawBody && config.meta.appSecret) {
        const valid = WebhookService.verifySignature(signature, rawBody);
        if (!valid) {
          console.error('❌ Invalid webhook signature');
          return res.sendStatus(403);
        }
      } else {
        console.warn('⚠️ Webhook signature missing or raw body empty');
      }

      let parsed: any = null;
      try {
        parsed = rawBody ? JSON.parse(rawBody) : req.body;
      } catch (e) {
        console.error('❌ Webhook JSON parse error');
        return res.sendStatus(400);
      }

      res.sendStatus(200);

      WebhookService.processMetaWebhook(parsed).catch((err) => {
        console.error('❌ Webhook async processing error:', err);
      });
    } catch (error) {
      console.error('❌ Meta webhook error:', error);
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
// REQUEST LOGGER (Debug middleware)
// ============================================
if (config.nodeEnv === 'development') {
  app.use((req: Request, res: Response, next: NextFunction) => {
    console.log(`📥 ${req.method} ${req.path}`);
    next();
  });
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

app.get('/health', async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      message: 'WabMeta API is healthy',
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
      uptime: Math.floor(process.uptime()),
      memory: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
      },
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'Service unhealthy',
      timestamp: new Date().toISOString(),
    });
  }
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
// API ROUTES (Order matters!)
// ============================================
const apiPrefix = `/api/${config.apiVersion}`;

// Core routes
app.use(`${apiPrefix}/auth`, authRoutes);
app.use(`${apiPrefix}/users`, userRoutes);
app.use(`${apiPrefix}/organizations`, organizationRoutes);

// Feature routes
app.use(`${apiPrefix}/contacts`, contactsRoutes);
app.use(`${apiPrefix}/templates`, templatesRoutes);
app.use(`${apiPrefix}/campaigns`, campaignsRoutes);
app.use(`${apiPrefix}/whatsapp`, whatsappRoutes);
app.use(`${apiPrefix}/inbox`, inboxRoutes);
app.use(`${apiPrefix}/chatbot`, chatbotRoutes);

// Integration routes
app.use(`${apiPrefix}/meta`, metaRoutes);
app.use(`${apiPrefix}/billing`, billingRoutes);
app.use(`${apiPrefix}/billing/razorpay`, razorpayRoutes); // ⚠️ More specific route should come first

// Admin & Dashboard
app.use(`${apiPrefix}/admin`, adminRoutes);
app.use(`${apiPrefix}/dashboard`, dashboardRoutes);

// ============================================
// LOG REGISTERED ROUTES (Development)
// ============================================
if (config.nodeEnv === 'development') {
  const routes: string[] = [];
  
  function extractRoutes(stack: any[], prefix = '') {
    stack.forEach((layer) => {
      if (layer.route) {
        const methods = Object.keys(layer.route.methods).join(', ').toUpperCase();
        routes.push(`   [${methods}] ${prefix}${layer.route.path}`);
      } else if (layer.name === 'router') {
        const routerPrefix = layer.regexp.source
          .replace('\\/?', '')
          .replace('(?=\\/|$)', '')
          .replace(/\\\//g, '/')
          .replace(/\^/g, '')
          .replace(/\$/g, '')
          .replace(/\\/g, '');
        
        extractRoutes(layer.handle.stack, prefix + routerPrefix);
      }
    });
  }

  console.log('\n📍 Registered API Routes:');
  console.log(`   ${apiPrefix}/auth`);
  console.log(`   ${apiPrefix}/users`);
  console.log(`   ${apiPrefix}/organizations`);
  console.log(`   ${apiPrefix}/contacts`);
  console.log(`   ${apiPrefix}/templates`);
  console.log(`   ${apiPrefix}/campaigns`);
  console.log(`   ${apiPrefix}/whatsapp`);
  console.log(`   ${apiPrefix}/inbox`);
  console.log(`   ${apiPrefix}/chatbot`);
  console.log(`   ${apiPrefix}/meta`);
  console.log(`   ${apiPrefix}/billing`);
  console.log(`   ${apiPrefix}/billing/razorpay`);
  console.log(`   ${apiPrefix}/admin`);
  console.log(`   ${apiPrefix}/dashboard`);
  console.log('   /webhooks/meta (GET, POST)');
  console.log('');
}

// ============================================
// 404 HANDLER (Must come AFTER all routes!)
// ============================================
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`❌ 404: ${req.method} ${req.url}`);
  sendError(res, `Route ${req.method} ${req.url} not found`, 404);
});

// ============================================
// ERROR HANDLER (Must be last!)
// ============================================
app.use(errorHandler);

export default app;