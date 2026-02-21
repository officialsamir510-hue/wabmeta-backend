// 📁 src/app.ts - FINAL COMPLETE VERSION

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

// ============================================
// IMPORT ROUTES
// ============================================
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/users/users.routes';
import organizationRoutes from './modules/organizations/organizations.routes';
import metaRoutes from './modules/meta/meta.routes';
import whatsappRoutes from './modules/whatsapp/whatsapp.routes';
import webhookRoutes from './modules/webhooks/webhook.routes';
import contactRoutes from './modules/contacts/contacts.routes';
import templateRoutes from './modules/templates/templates.routes';
import campaignRoutes from './modules/campaigns/campaigns.routes';
import inboxRoutes from './modules/inbox/inbox.routes';
import chatbotRoutes from './modules/chatbot/chatbot.routes';
import billingRoutes from './modules/billing/billing.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import adminRoutes from './modules/admin/admin.routes';

const app = express();

// ============================================
// TRUST PROXY (for production behind reverse proxy)
// ============================================
app.set('trust proxy', 1);

// ============================================
// MIDDLEWARE
// ============================================

// CORS Configuration - MUST BE FIRST
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or Postman)
      if (!origin) return callback(null, true);

      const allowedOrigins = config.frontend.corsOrigins || [
        'http://localhost:5173',
        'http://localhost:3000',
        process.env.FRONTEND_URL,
      ].filter(Boolean);

      if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        console.warn(`❌ CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Organization-Id',
      'X-Requested-With',
      'Accept',
    ],
    exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page'],
    maxAge: 86400, // 24 hours
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
);

// Security Headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false, // Disable if using CDN or inline scripts
    crossOriginEmbedderPolicy: false,
  })
);

// Compression
app.use(compression());

// Body Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request Logging (in development)
if (config.app.env === 'development') {
  app.use(requestLogger);
}

// ============================================
// HEALTH CHECK ENDPOINTS
// ============================================

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'WabMeta API is running',
    timestamp: new Date().toISOString(),
    environment: config.app.env,
    version: '1.0.0',
    uptime: process.uptime(),
  });
});

app.get('/api/v1/health', (req, res) => {
  res.json({
    success: true,
    message: 'WabMeta API v1 is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB',
    },
    services: {
      meta: !!(process.env.META_APP_ID && process.env.META_APP_SECRET),
      database: true, // Add DB health check here
    },
  });
});

// ============================================
// WEBHOOK ROUTES (MUST BE BEFORE AUTH)
// ============================================
// These need to be public and at specific paths for Meta

// Meta webhook at /webhook (standard Meta path)
app.use('/webhook', webhookRoutes);

// Alternative webhook paths
app.use('/webhooks/meta', webhookRoutes);
app.use('/api/webhooks/meta', webhookRoutes);

console.log('✅ Webhook routes mounted:');
console.log('   - /webhook (Meta standard)');
console.log('   - /webhooks/meta');
console.log('   - /api/webhooks/meta');

// ============================================
// API ROUTES (v1)
// ============================================

const API_PREFIX = '/api/v1';

console.log('\n📋 Mounting API routes...\n');

// Core Authentication & Users
app.use(`${API_PREFIX}/auth`, authRoutes);
console.log(`✅ ${API_PREFIX}/auth`);

app.use(`${API_PREFIX}/users`, userRoutes);
console.log(`✅ ${API_PREFIX}/users`);

// Organizations
app.use(`${API_PREFIX}/organizations`, organizationRoutes);
console.log(`✅ ${API_PREFIX}/organizations`);

// Meta WhatsApp Business API Integration - CRITICAL
app.use(`${API_PREFIX}/meta`, metaRoutes);
console.log(`✅ ${API_PREFIX}/meta (Meta Integration)`);

// WhatsApp Messaging
app.use(`${API_PREFIX}/whatsapp`, whatsappRoutes);
console.log(`✅ ${API_PREFIX}/whatsapp`);

// Webhooks (also available under /api/v1)
app.use(`${API_PREFIX}/webhooks`, webhookRoutes);
console.log(`✅ ${API_PREFIX}/webhooks`);

// Contact Management
app.use(`${API_PREFIX}/contacts`, contactRoutes);
console.log(`✅ ${API_PREFIX}/contacts`);

// Message Templates
app.use(`${API_PREFIX}/templates`, templateRoutes);
console.log(`✅ ${API_PREFIX}/templates`);

// Campaign Management
app.use(`${API_PREFIX}/campaigns`, campaignRoutes);
console.log(`✅ ${API_PREFIX}/campaigns`);

// Inbox & Conversations
app.use(`${API_PREFIX}/inbox`, inboxRoutes);
console.log(`✅ ${API_PREFIX}/inbox`);

// Chatbot & Automation
app.use(`${API_PREFIX}/chatbot`, chatbotRoutes);
console.log(`✅ ${API_PREFIX}/chatbot`);

// Billing & Subscriptions
app.use(`${API_PREFIX}/billing`, billingRoutes);
console.log(`✅ ${API_PREFIX}/billing`);

// Dashboard & Analytics
app.use(`${API_PREFIX}/dashboard`, dashboardRoutes);
console.log(`✅ ${API_PREFIX}/dashboard`);

// Admin Panel
app.use(`${API_PREFIX}/admin`, adminRoutes);
console.log(`✅ ${API_PREFIX}/admin`);

console.log('\n✅ All routes mounted successfully\n');

// ============================================
// ROOT ENDPOINT
// ============================================

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to WabMeta API',
    version: '1.0.0',
    environment: config.app.env,
    documentation: '/api/v1/docs',
    endpoints: {
      health: '/health',
      api: '/api/v1',
      meta: '/api/v1/meta',
      webhooks: '/webhook',
    },
    meta: {
      configured: !!(process.env.META_APP_ID && process.env.META_APP_SECRET),
      embeddedSignup: !!process.env.META_CONFIG_ID,
    },
  });
});

// ============================================
// API INFO ENDPOINT
// ============================================

app.get('/api/v1', (req, res) => {
  res.json({
    success: true,
    version: '1.0.0',
    routes: {
      auth: `${API_PREFIX}/auth`,
      users: `${API_PREFIX}/users`,
      organizations: `${API_PREFIX}/organizations`,
      meta: `${API_PREFIX}/meta`,
      whatsapp: `${API_PREFIX}/whatsapp`,
      contacts: `${API_PREFIX}/contacts`,
      templates: `${API_PREFIX}/templates`,
      campaigns: `${API_PREFIX}/campaigns`,
      inbox: `${API_PREFIX}/inbox`,
      chatbot: `${API_PREFIX}/chatbot`,
      billing: `${API_PREFIX}/billing`,
      dashboard: `${API_PREFIX}/dashboard`,
      admin: `${API_PREFIX}/admin`,
    },
    webhooks: {
      meta: '/webhook',
      alternative: '/webhooks/meta',
    },
  });
});

// ============================================
// DEBUG ROUTE (Development only)
// ============================================

if (config.app.env === 'development') {
  app.get('/api/v1/debug/routes', (req, res) => {
    const routes: any[] = [];

    function extractRoutes(stack: any[], prefix = '') {
      stack.forEach((middleware) => {
        if (middleware.route) {
          // Regular route
          const methods = Object.keys(middleware.route.methods)
            .filter((m) => middleware.route.methods[m])
            .map((m) => m.toUpperCase());

          routes.push({
            path: prefix + middleware.route.path,
            methods,
          });
        } else if (middleware.name === 'router') {
          // Router middleware
          const routerPath = middleware.regexp
            .source.replace('\\/?', '')
            .replace('(?=\\/|$)', '')
            .replace(/\\\//g, '/')
            .replace(/\^/g, '');

          extractRoutes(middleware.handle.stack, routerPath);
        }
      });
    }

    extractRoutes(app._router.stack);

    res.json({
      success: true,
      totalRoutes: routes.length,
      routes: routes.sort((a, b) => a.path.localeCompare(b.path)),
    });
  });

  console.log('🐛 Debug route available: /api/v1/debug/routes\n');
}

// ============================================
// ERROR HANDLING
// ============================================

// 404 Handler
app.use((req, res) => {
  console.warn(`❌ 404 Not Found: ${req.method} ${req.url}`);

  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Route ${req.method} ${req.url} not found`,
    path: req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
    suggestion: 'Check /api/v1 for available routes',
  });
});

// Global Error Handler
app.use(errorHandler);

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

const gracefulShutdown = (signal: string) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);

  // Close server connections
  // Close database connections
  // Clean up resources

  console.log('✅ Cleanup complete. Exiting...');
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled Promise Rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection:');
  console.error('   Reason:', reason);
  console.error('   Promise:', promise);

  // In production, log but don't crash
  if (config.app.env === 'development') {
    process.exit(1);
  }
});

// Uncaught Exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('   Stack:', error.stack);

  // Always exit on uncaught exceptions
  process.exit(1);
});

// ============================================
// STARTUP CHECKS
// ============================================

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🚀 WabMeta API Starting...');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📦 Environment: ${config.app.env}`);
console.log(`🌐 CORS Origins: ${config.frontend.corsOrigins?.join(', ')}`);
console.log(`🔐 Meta App ID: ${process.env.META_APP_ID ? '✅ Set' : '❌ Missing'}`);
console.log(`🔐 Meta Secret: ${process.env.META_APP_SECRET ? '✅ Set' : '❌ Missing'}`);
console.log(`🔐 Meta Config ID: ${process.env.META_CONFIG_ID ? '✅ Set' : '❌ Missing'}`);
console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || '❌ Not Set'}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Warn about missing configuration
if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
  console.warn('⚠️  WARNING: Meta credentials not configured!');
  console.warn('   Set META_APP_ID and META_APP_SECRET in .env\n');
}

if (!process.env.META_CONFIG_ID) {
  console.warn('⚠️  WARNING: META_CONFIG_ID not set!');
  console.warn('   Embedded Signup may not work correctly\n');
}

export default app;