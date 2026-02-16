"use strict";
// 📁 src/app.ts - ADD THESE ROUTES
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
// Import routes
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
// MIDDLEWARE
// ============================================
// CORS
app.use((0, cors_1.default)({
    origin: config_1.config.frontend.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Organization-Id'],
}));
// Security
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
// Compression
app.use((0, compression_1.default)());
// Body parsing
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Request logging
app.use(requestLogger_1.requestLogger);
// ============================================
// HEALTH CHECK
// ============================================
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'WabMeta API is running',
        timestamp: new Date().toISOString(),
        environment: config_1.config.app.env,
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
app.use(`${API_PREFIX}/auth`, auth_routes_1.default);
// Users
app.use(`${API_PREFIX}/users`, users_routes_1.default);
// Organizations
app.use(`${API_PREFIX}/organizations`, organizations_routes_1.default);
// Meta (WhatsApp Business API connection)
app.use(`${API_PREFIX}/meta`, meta_routes_1.default);
// WhatsApp (messaging)
app.use(`${API_PREFIX}/whatsapp`, whatsapp_routes_1.default);
// Webhooks (Meta callbacks)
app.use(`${API_PREFIX}/webhooks`, webhook_routes_1.default);
app.use('/webhook', webhook_routes_1.default); // Direct webhook URL for Meta
// Contacts
app.use(`${API_PREFIX}/contacts`, contacts_routes_1.default);
// Templates
app.use(`${API_PREFIX}/templates`, templates_routes_1.default);
// Campaigns
app.use(`${API_PREFIX}/campaigns`, campaigns_routes_1.default);
// Inbox
app.use(`${API_PREFIX}/inbox`, inbox_routes_1.default);
// Chatbot
app.use(`${API_PREFIX}/chatbot`, chatbot_routes_1.default);
// Billing
app.use(`${API_PREFIX}/billing`, billing_routes_1.default);
// Dashboard
app.use(`${API_PREFIX}/dashboard`, dashboard_routes_1.default);
// Admin
app.use(`${API_PREFIX}/admin`, admin_routes_1.default);
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
app.use(errorHandler_1.errorHandler);
exports.default = app;
//# sourceMappingURL=app.js.map