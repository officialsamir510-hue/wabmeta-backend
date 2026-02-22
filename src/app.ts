// src/app.ts - COMPLETE FIXED VERSION

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

// Import all routes
import authRoutes from './modules/auth/auth.routes';
import contactsRoutes from './modules/contacts/contacts.routes';
import campaignsRoutes from './modules/campaigns/campaigns.routes';
import templatesRoutes from './modules/templates/templates.routes';
import webhookRoutes from './modules/webhooks/webhook.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import organizationsRoutes from './modules/organizations/organizations.routes';
import usersRoutes from './modules/users/users.routes';
import metaRoutes from './modules/meta/meta.routes';
import whatsappRoutes from './modules/whatsapp/whatsapp.routes';
import chatbotRoutes from './modules/chatbot/chatbot.routes';
import inboxRoutes from './modules/inbox/inbox.routes';
import billingRoutes from './modules/billing/billing.routes';
import adminRoutes from './modules/admin/admin.routes';

const app: Application = express();

// ============================================
// TRUST PROXY (for Render/production)
// ============================================
app.set('trust proxy', 1);

// ============================================
// SECURITY MIDDLEWARE
// ============================================
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// ============================================
// CORS CONFIGURATION - FIXED
// ============================================
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
  : [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://wabmeta.com',
    'https://www.wabmeta.com',
  ];

console.log('🔒 CORS Allowed Origins:', allowedOrigins);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin) {
        return callback(null, true);
      }

      // Check if origin is in allowed list
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.warn(`⚠️ CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Organization-Id', // ✅ CRITICAL FIX
      'x-organization-id', // ✅ CRITICAL FIX (lowercase variant)
      'Accept',
      'Origin',
    ],
    exposedHeaders: ['Content-Range', 'X-Content-Range', 'X-Total-Count'],
    maxAge: 600, // Preflight cache: 10 minutes
    optionsSuccessStatus: 204,
  })
);

// ============================================
// EXPLICIT PREFLIGHT HANDLER
// ============================================
app.options('*', cors());

// ============================================
// BODY PARSING
// ============================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// LOGGING
// ============================================
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Custom request logger
app.use(requestLogger);

// ============================================
// STATIC FILES (if needed)
// ============================================
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ============================================
// HEALTH CHECK
// ============================================
app.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'WabMeta API Server',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Server is healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ============================================
// API ROUTES
// ============================================

// Public routes (no auth required)
app.use('/api/auth', authRoutes);
app.use('/api/webhooks', webhookRoutes); // ✅ Webhooks must be public for Meta

// Protected routes (auth required)
app.use('/api/contacts', contactsRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/organizations', organizationsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/meta', metaRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/inbox', inboxRoutes);
app.use('/api/billing', billingRoutes);

// Admin routes
app.use('/api/admin', adminRoutes);

// ============================================
// 404 HANDLER
// ============================================
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.path}`,
  });
});

// ============================================
// ERROR HANDLER
// ============================================
app.use(errorHandler);

export default app;