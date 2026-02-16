// 📁 src/app.ts - ADD THESE ROUTES

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

// Import routes
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
// MIDDLEWARE
// ============================================

// CORS
app.use(cors({
  origin: config.frontend.corsOrigins as any,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Organization-Id'],
}));

// Security
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'WabMeta API is running',
    timestamp: new Date().toISOString(),
    environment: config.app.env,
  });
});

app.get('/api/v1/health', (req, res) => {
  res.json({
    success: true,
    message: 'WabMeta API v1 is running',
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// API ROUTES
// ============================================

const API_PREFIX = '/api/v1';

// Auth
app.use(`${API_PREFIX}/auth`, authRoutes);

// Users
app.use(`${API_PREFIX}/users`, userRoutes);

// Organizations
app.use(`${API_PREFIX}/organizations`, organizationRoutes);

// Meta (WhatsApp Business API connection)
app.use(`${API_PREFIX}/meta`, metaRoutes);

// WhatsApp (messaging)
app.use(`${API_PREFIX}/whatsapp`, whatsappRoutes);

// Webhooks (Meta callbacks)
app.use(`${API_PREFIX}/webhooks`, webhookRoutes);
app.use('/webhook', webhookRoutes); // Direct webhook URL for Meta

// Contacts
app.use(`${API_PREFIX}/contacts`, contactRoutes);

// Templates
app.use(`${API_PREFIX}/templates`, templateRoutes);

// Campaigns
app.use(`${API_PREFIX}/campaigns`, campaignRoutes);

// Inbox
app.use(`${API_PREFIX}/inbox`, inboxRoutes);

// Chatbot
app.use(`${API_PREFIX}/chatbot`, chatbotRoutes);

// Billing
app.use(`${API_PREFIX}/billing`, billingRoutes);

// Dashboard
app.use(`${API_PREFIX}/dashboard`, dashboardRoutes);

// Admin
app.use(`${API_PREFIX}/admin`, adminRoutes);

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.url} not found`,
  });
});

// Global error handler
app.use(errorHandler);

export default app;