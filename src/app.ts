// 📁 src/app.ts - MAIN APPLICATION FILE

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

// CORS Configuration
app.use(
  cors({
    origin: config.frontend.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Organization-Id'],
    exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page'],
    maxAge: 86400, // 24 hours
  })
);

// Security Headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false, // Disable if using CDN
  })
);

// Compression
app.use(compression());

// Body Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request Logging
app.use(requestLogger);

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
  });
});

app.get('/api/v1/health', (req, res) => {
  res.json({
    success: true,
    message: 'WabMeta API v1 is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// ============================================
// WEBHOOK ROUTES (MUST BE BEFORE API ROUTES)
// ============================================
// Meta webhooks need to be at /webhook for easy configuration
app.use('/webhooks/meta', webhookRoutes);

// ============================================
// API ROUTES
// ============================================

const API_PREFIX = '/api/v1';

// Core Authentication & Users
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/users`, userRoutes);

// Organizations
app.use(`${API_PREFIX}/organizations`, organizationRoutes);

// Meta WhatsApp Business API Integration
app.use(`${API_PREFIX}/meta`, metaRoutes);

// WhatsApp Messaging
app.use(`${API_PREFIX}/whatsapp`, whatsappRoutes);

// Webhooks (also available under /api/v1)
app.use(`${API_PREFIX}/webhooks`, webhookRoutes);

// Contact Management
app.use(`${API_PREFIX}/contacts`, contactRoutes);

// Message Templates
app.use(`${API_PREFIX}/templates`, templateRoutes);

// Campaign Management
app.use(`${API_PREFIX}/campaigns`, campaignRoutes);

// Inbox & Conversations
app.use(`${API_PREFIX}/inbox`, inboxRoutes);

// Chatbot & Automation
app.use(`${API_PREFIX}/chatbot`, chatbotRoutes);

// Billing & Subscriptions
app.use(`${API_PREFIX}/billing`, billingRoutes);

// Dashboard & Analytics
app.use(`${API_PREFIX}/dashboard`, dashboardRoutes);

// Admin Panel
app.use(`${API_PREFIX}/admin`, adminRoutes);

// ============================================
// ROOT ENDPOINT
// ============================================

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to WabMeta API',
    version: '1.0.0',
    documentation: '/api/v1/docs',
    endpoints: {
      health: '/health',
      api: '/api/v1',
      webhooks: '/webhook',
    },
  });
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Route ${req.method} ${req.url} not found`,
    timestamp: new Date().toISOString(),
  });
});

// Global Error Handler
app.use(errorHandler);

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

const gracefulShutdown = (signal: string) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);

  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled Promise Rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit in production, just log
  if (config.app.env === 'development') {
    process.exit(1);
  }
});

// Uncaught Exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

export default app;