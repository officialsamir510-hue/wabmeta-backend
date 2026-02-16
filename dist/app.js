"use strict";
// 📁 src/app.ts - MAIN APPLICATION FILE
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const config_1 = require("./config");
const errorHandler_1 = require("./middleware/errorHandler");
const requestLogger_1 = require("./middleware/requestLogger");
// ============================================
// IMPORT ROUTES
// ============================================
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const users_routes_1 = __importDefault(require("./modules/users/users.routes"));
const organizations_routes_1 = __importDefault(require("./modules/organizations/organizations.routes"));
const meta_routes_1 = __importDefault(require("./modules/meta/meta.routes"));
const whatsapp_routes_1 = __importDefault(require("./modules/whatsapp/whatsapp.routes"));
const webhook_routes_1 = __importDefault(require("./modules/webhooks/webhook.routes"));
const contacts_routes_1 = __importDefault(require("./modules/contacts/contacts.routes"));
const templates_routes_1 = __importDefault(require("./modules/templates/templates.routes"));
const campaigns_routes_1 = __importDefault(require("./modules/campaigns/campaigns.routes"));
const inbox_routes_1 = __importDefault(require("./modules/inbox/inbox.routes"));
const chatbot_routes_1 = __importDefault(require("./modules/chatbot/chatbot.routes"));
const billing_routes_1 = __importDefault(require("./modules/billing/billing.routes"));
const dashboard_routes_1 = __importDefault(require("./modules/dashboard/dashboard.routes"));
const admin_routes_1 = __importDefault(require("./modules/admin/admin.routes"));
const app = (0, express_1.default)();
// ============================================
// TRUST PROXY (for production behind reverse proxy)
// ============================================
app.set('trust proxy', 1);
// ============================================
// MIDDLEWARE
// ============================================
// CORS Configuration
app.use((0, cors_1.default)({
    origin: config_1.config.frontend.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Organization-Id'],
    exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page'],
    maxAge: 86400, // 24 hours
}));
// Security Headers
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false, // Disable if using CDN
}));
// Compression
app.use((0, compression_1.default)());
// Body Parsing
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Request Logging
app.use(requestLogger_1.requestLogger);
// ============================================
// HEALTH CHECK ENDPOINTS
// ============================================
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'WabMeta API is running',
        timestamp: new Date().toISOString(),
        environment: config_1.config.app.env,
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
app.use('/webhook', webhook_routes_1.default);
// ============================================
// API ROUTES
// ============================================
const API_PREFIX = '/api/v1';
// Core Authentication & Users
app.use(`${API_PREFIX}/auth`, auth_routes_1.default);
app.use(`${API_PREFIX}/users`, users_routes_1.default);
// Organizations
app.use(`${API_PREFIX}/organizations`, organizations_routes_1.default);
// Meta WhatsApp Business API Integration
app.use(`${API_PREFIX}/meta`, meta_routes_1.default);
// WhatsApp Messaging
app.use(`${API_PREFIX}/whatsapp`, whatsapp_routes_1.default);
// Webhooks (also available under /api/v1)
app.use(`${API_PREFIX}/webhooks`, webhook_routes_1.default);
// Contact Management
app.use(`${API_PREFIX}/contacts`, contacts_routes_1.default);
// Message Templates
app.use(`${API_PREFIX}/templates`, templates_routes_1.default);
// Campaign Management
app.use(`${API_PREFIX}/campaigns`, campaigns_routes_1.default);
// Inbox & Conversations
app.use(`${API_PREFIX}/inbox`, inbox_routes_1.default);
// Chatbot & Automation
app.use(`${API_PREFIX}/chatbot`, chatbot_routes_1.default);
// Billing & Subscriptions
app.use(`${API_PREFIX}/billing`, billing_routes_1.default);
// Dashboard & Analytics
app.use(`${API_PREFIX}/dashboard`, dashboard_routes_1.default);
// Admin Panel
app.use(`${API_PREFIX}/admin`, admin_routes_1.default);
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
app.use(errorHandler_1.errorHandler);
// ============================================
// GRACEFUL SHUTDOWN
// ============================================
const gracefulShutdown = (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    process.exit(0);
};
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
// Unhandled Promise Rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit in production, just log
    if (config_1.config.app.env === 'development') {
        process.exit(1);
    }
});
// Uncaught Exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});
exports.default = app;
//# sourceMappingURL=app.js.map