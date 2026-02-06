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

// ✅ Import Meta routes
import metaRoutes from './modules/meta/meta.routes';

const app: Express = express();

// ============================================
// TRUST PROXY (Required for Render)
// ============================================
app.set('trust proxy', 1);

// ============================================
// CORS CONFIGURATION - MUST BE FIRST!
// ============================================

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'https://wabmeta.com',
  'https://www.wabmeta.com',
];

// Add FRONTEND_URL if it's set and not already in the list
if (config.frontendUrl && !allowedOrigins.includes(config.frontendUrl)) {
  allowedOrigins.push(config.frontendUrl);
}

console.log('🌐 CORS Allowed Origins:', allowedOrigins);

// CORS Options
const corsOptions: cors.CorsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (mobile apps, curl, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Log blocked origins for debugging
    console.log('⚠️ CORS request from non-whitelisted origin:', origin);
    
    // In production, you might want to be strict
    // For now, allow all origins for debugging
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
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

// Apply CORS middleware FIRST
app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// ============================================
// MANUAL CORS HEADERS (Backup)
// ============================================
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  
  // Set CORS headers manually as backup
  if (origin && (allowedOrigins.includes(origin) || true)) { // Allow all for now
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, x-platform, Cache-Control, Pragma');
  res.setHeader('Access-Control-Max-Age', '86400');
  
  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  next();
});

// ============================================
// SECURITY MIDDLEWARE (After CORS!)
// ============================================
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false, // Disable CSP for API
}));

// ============================================
// PARSING & OTHER MIDDLEWARE
// ============================================

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser
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

// Root route
app.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'WabMeta API Server',
    version: config.apiVersion,
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'WabMeta API is running',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    uptime: process.uptime(),
  });
});

// CORS Debug endpoint
app.get('/api/debug/cors', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'CORS is working!',
    origin: req.headers.origin || 'No origin header',
    allowedOrigins: allowedOrigins,
    frontendUrl: config.frontendUrl,
    headers: {
      'access-control-allow-origin': res.getHeader('Access-Control-Allow-Origin'),
      'access-control-allow-credentials': res.getHeader('Access-Control-Allow-Credentials'),
    },
  });
});

// Test POST endpoint for CORS
app.post('/api/debug/cors-test', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'POST request successful!',
    receivedData: req.body,
    origin: req.headers.origin,
  });
});

// ============================================
// ✅ META WEBHOOKS (Before API prefix)
// ============================================

// Meta webhook verification (GET)
app.get('/webhooks/meta', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'] as string | undefined;
  const token = req.query['hub.verify_token'] as string | undefined;
  const challenge = req.query['hub.challenge'] as string | undefined;

  // ✅ FIXED: Type-safe token slicing
  const tokenPreview = token ? token.slice(0, 10) + '...' : 'undefined';
  console.log('🔍 Meta webhook verification:', { mode, token: tokenPreview });

  if (mode === 'subscribe' && token === config.meta.webhookVerifyToken) {
    console.log('✅ Meta webhook verified');
    return res.status(200).send(challenge);
  }

  console.error('❌ Meta webhook verification failed');
  res.sendStatus(403);
});

// Meta webhook events (POST)
app.post('/webhooks/meta', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  try {
    console.log('📥 Meta webhook received');
    
    // Process webhook asynchronously (don't block response)
    // You can import and call your webhook handler here
    // Example: void webhookService.processMetaWebhook(req.body);
    
    // Always respond quickly to Meta
    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Meta webhook error:', error);
    res.sendStatus(200); // Still return 200 to prevent retries
  }
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

// ✅ Add Meta routes
app.use(`${apiPrefix}/meta`, metaRoutes);

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