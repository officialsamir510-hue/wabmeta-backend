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

const app: Express = express();

// ============================================
// CORS CONFIGURATION - MUST BE FIRST!
// ============================================

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'https://wabmeta.com',
  'https://www.wabmeta.com',
  config.frontendUrl,
].filter(Boolean); // Remove any undefined values

console.log('🌐 Allowed CORS Origins:', allowedOrigins);

// Handle preflight requests FIRST
app.options('*', cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-platform', 'X-Requested-With', 'Accept'],
}));

// Apply CORS to all routes
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('❌ CORS blocked origin:', origin);
      callback(null, true); // Temporarily allow all for debugging
      // callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-platform', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['set-cookie'],
}));

// ============================================
// SECURITY & PARSING MIDDLEWARE
// ============================================

// Security headers (after CORS)
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
}));

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
// HEALTH CHECK
// ============================================

app.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'WabMeta API Server',
    version: config.apiVersion,
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'WabMeta API is running',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

// Debug endpoint to check CORS
app.get('/api/debug/cors', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'CORS is working!',
    origin: req.headers.origin,
    allowedOrigins: allowedOrigins,
    frontendUrl: config.frontendUrl,
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