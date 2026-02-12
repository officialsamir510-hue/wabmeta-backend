"use strict";
// src/app.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const compression_1 = __importDefault(require("compression"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const crypto_1 = __importDefault(require("crypto"));
const config_1 = require("./config");
const database_1 = __importDefault(require("./config/database"));
const rateLimit_1 = require("./middleware/rateLimit");
const errorHandler_1 = require("./middleware/errorHandler");
// ============================================
// IMPORT ROUTES (Only existing ones)
// ============================================
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const meta_routes_1 = __importDefault(require("./modules/meta/meta.routes"));
const whatsapp_routes_1 = __importDefault(require("./modules/whatsapp/whatsapp.routes"));
const inbox_routes_1 = __importDefault(require("./modules/inbox/inbox.routes"));
const contacts_routes_1 = __importDefault(require("./modules/contacts/contacts.routes"));
const templates_routes_1 = __importDefault(require("./modules/templates/templates.routes"));
const campaigns_routes_1 = __importDefault(require("./modules/campaigns/campaigns.routes"));
const dashboard_routes_1 = __importDefault(require("./modules/dashboard/dashboard.routes"));
const billing_routes_1 = __importDefault(require("./modules/billing/billing.routes"));
const organizations_routes_1 = __importDefault(require("./modules/organizations/organizations.routes"));
const users_routes_1 = __importDefault(require("./modules/users/users.routes"));
const chatbot_routes_1 = __importDefault(require("./modules/chatbot/chatbot.routes"));
const webhook_routes_1 = __importDefault(require("./modules/webhooks/webhook.routes"));
// Initialize Express App
const app = (0, express_1.default)();
// Trust proxy
app.set('trust proxy', 1);
// ============================================
// CORS CONFIGURATION
// ============================================
const normalizeOrigin = (o) => (o || '').replace(/\/$/, '');
const allowedOrigins = Array.from(new Set((config_1.config.frontend?.corsOrigins || []).map(normalizeOrigin))).filter(Boolean);
const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin)
            return callback(null, true);
        const normalized = normalizeOrigin(origin);
        if (allowedOrigins.includes(normalized)) {
            return callback(null, true);
        }
        // In development, allow all
        if (config_1.config.nodeEnv === 'development') {
            return callback(null, true);
        }
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Total-Pages'],
    maxAge: 86400,
};
app.use((0, cors_1.default)(corsOptions));
// ============================================
// SECURITY MIDDLEWARE
// ============================================
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
}));
// ============================================
// WEBHOOK ROUTES (Before body parsing!)
// ============================================
// Meta Webhook Verification (GET)
app.get('/webhooks/meta', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    console.log('Meta Webhook Verification:', { mode, hasToken: !!token });
    if (mode === 'subscribe' && token === (process.env.WEBHOOK_VERIFY_TOKEN || 'webhook-verify-token')) {
        console.log('✅ Webhook Verified');
        return res.status(200).send(challenge);
    }
    console.error('❌ Webhook Verification Failed');
    return res.sendStatus(403);
});
// Meta Webhook Events (POST) - Raw body for signature verification
app.post('/webhooks/meta', express_1.default.raw({ type: 'application/json', limit: '10mb' }), async (req, res) => {
    try {
        // Verify signature
        const signature = req.header('x-hub-signature-256') || '';
        const body = req.body;
        const appSecret = config_1.config.meta.appSecret || process.env.META_APP_SECRET || '';
        if (!appSecret) {
            console.error('Webhook Error: META_APP_SECRET missing');
            return res.sendStatus(500);
        }
        const expected = 'sha256=' + crypto_1.default.createHmac('sha256', appSecret).update(body).digest('hex');
        let valid = false;
        try {
            valid = signature.length === expected.length && crypto_1.default.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
        }
        catch {
            valid = false;
        }
        if (!valid) {
            console.warn('Webhook Error: Invalid signature');
            return res.sendStatus(403);
        }
        // Acknowledge first
        res.sendStatus(200);
        // Process asynchronously
        const payload = JSON.parse(body.toString());
        const { webhookService } = await Promise.resolve().then(() => __importStar(require('./modules/webhooks/webhook.service')));
        setImmediate(() => {
            webhookService.processWebhook(payload).catch(console.error);
        });
    }
    catch (error) {
        console.error('Webhook Error:', error);
        return res.sendStatus(200); // Avoid retries on unexpected errors
    }
});
// ============================================
// BODY PARSING MIDDLEWARE
// ============================================
app.use((0, compression_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use((0, cookie_parser_1.default)());
// ============================================
// RATE LIMITING
// ============================================
app.use((0, rateLimit_1.rateLimit)({ windowMs: 15 * 60 * 1000, max: config_1.config.rateLimit.max }));
app.use('/api/auth', rateLimit_1.authRateLimit);
// ============================================
// LOGGING MIDDLEWARE
// ============================================
if (config_1.config.nodeEnv === 'development') {
    app.use((0, morgan_1.default)('dev'));
}
else {
    app.use((0, morgan_1.default)('combined'));
}
// ============================================
// HEALTH CHECK ROUTES
// ============================================
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'WabMeta API Server',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
    });
});
app.get('/health', async (req, res) => {
    try {
        // Check database with shared prisma
        await database_1.default.$queryRaw `SELECT 1`;
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: config_1.config.nodeEnv,
        });
    }
    catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
// ============================================
// API ROUTES
// ============================================
const apiPrefix = '/api/v1';
// Auth routes
app.use(`${apiPrefix}/auth`, auth_routes_1.default);
// Core routes
app.use(`${apiPrefix}/users`, users_routes_1.default);
app.use(`${apiPrefix}/organizations`, organizations_routes_1.default);
// Feature routes
app.use(`${apiPrefix}/contacts`, contacts_routes_1.default);
app.use(`${apiPrefix}/templates`, templates_routes_1.default);
app.use(`${apiPrefix}/campaigns`, campaigns_routes_1.default);
app.use(`${apiPrefix}/whatsapp`, whatsapp_routes_1.default);
app.use(`${apiPrefix}/inbox`, inbox_routes_1.default);
app.use(`${apiPrefix}/chatbot`, chatbot_routes_1.default);
app.use(`${apiPrefix}/dashboard`, dashboard_routes_1.default);
app.use(`${apiPrefix}/billing`, billing_routes_1.default);
// Integration routes
app.use(`${apiPrefix}/meta`, meta_routes_1.default);
app.use(`${apiPrefix}/webhooks`, webhook_routes_1.default);
// Admin routes (if exists)
try {
    const adminRoutes = require('./modules/admin/admin.routes').default;
    app.use(`${apiPrefix}/admin`, adminRoutes);
}
catch (e) {
    // Admin module not implemented yet
}
// ============================================
// ERROR HANDLING
// ============================================
// 404 Handler
app.use(errorHandler_1.notFoundHandler);
// Global Error Handler
app.use(errorHandler_1.errorHandler);
exports.default = app;
//# sourceMappingURL=app.js.map