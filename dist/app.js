"use strict";
// src/app.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const path_1 = __importDefault(require("path"));
const errorHandler_1 = require("./middleware/errorHandler");
const requestLogger_1 = require("./middleware/requestLogger");
// Import all routes
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const contacts_routes_1 = __importDefault(require("./modules/contacts/contacts.routes"));
const campaigns_routes_1 = __importDefault(require("./modules/campaigns/campaigns.routes"));
const templates_routes_1 = __importDefault(require("./modules/templates/templates.routes"));
const webhook_routes_1 = __importDefault(require("./modules/webhooks/webhook.routes"));
const dashboard_routes_1 = __importDefault(require("./modules/dashboard/dashboard.routes"));
const organizations_routes_1 = __importDefault(require("./modules/organizations/organizations.routes"));
const users_routes_1 = __importDefault(require("./modules/users/users.routes"));
const meta_routes_1 = __importDefault(require("./modules/meta/meta.routes"));
const whatsapp_routes_1 = __importDefault(require("./modules/whatsapp/whatsapp.routes"));
const chatbot_routes_1 = __importDefault(require("./modules/chatbot/chatbot.routes"));
const inbox_routes_1 = __importDefault(require("./modules/inbox/inbox.routes"));
const billing_routes_1 = __importDefault(require("./modules/billing/billing.routes"));
const admin_routes_1 = __importDefault(require("./modules/admin/admin.routes"));
const app = (0, express_1.default)();
// ============================================
// TRUST PROXY (for Render/production)
// ============================================
app.set('trust proxy', 1);
// ============================================
// SECURITY MIDDLEWARE
// ============================================
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
}));
// ============================================
// CORS CONFIGURATION
// ============================================
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : [
        'http://localhost:3000',
        'http://localhost:5173',
        'https://wabmeta.com',
        'https://www.wabmeta.com',
    ];
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
// ============================================
// BODY PARSING
// ============================================
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// ============================================
// LOGGING
// ============================================
if (process.env.NODE_ENV === 'development') {
    app.use((0, morgan_1.default)('dev'));
}
// Custom request logger
app.use(requestLogger_1.requestLogger);
// ============================================
// STATIC FILES (if needed)
// ============================================
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
// ============================================
// HEALTH CHECK
// ============================================
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'WabMeta API Server',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
    });
});
app.get('/health', (req, res) => {
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
app.use('/api/auth', auth_routes_1.default);
app.use('/api/webhooks', webhook_routes_1.default); // ✅ Webhooks must be public for Meta
// Protected routes (auth required)
app.use('/api/contacts', contacts_routes_1.default);
app.use('/api/campaigns', campaigns_routes_1.default);
app.use('/api/templates', templates_routes_1.default);
app.use('/api/dashboard', dashboard_routes_1.default);
app.use('/api/organizations', organizations_routes_1.default);
app.use('/api/users', users_routes_1.default);
app.use('/api/meta', meta_routes_1.default);
app.use('/api/whatsapp', whatsapp_routes_1.default);
app.use('/api/chatbot', chatbot_routes_1.default);
app.use('/api/inbox', inbox_routes_1.default);
app.use('/api/billing', billing_routes_1.default);
// Admin routes
app.use('/api/admin', admin_routes_1.default);
// ============================================
// 404 HANDLER
// ============================================
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.path}`,
    });
});
// ============================================
// ERROR HANDLER
// ============================================
app.use(errorHandler_1.errorHandler);
exports.default = app;
//# sourceMappingURL=app.js.map