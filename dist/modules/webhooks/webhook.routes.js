"use strict";
// 📁 src/modules/webhooks/webhook.routes.ts - COMPLETE WEBHOOK ROUTES
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const webhook_service_1 = require("./webhook.service");
const database_1 = __importDefault(require("../../config/database"));
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
// ============================================
// WEBHOOK VERIFICATION (GET) - PUBLIC
// ============================================
router.get('/', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    console.log('📨 Webhook verification request received');
    const result = webhook_service_1.webhookService.verifyWebhook(mode, token, challenge);
    if (result) {
        res.status(200).send(result);
    }
    else {
        res.sendStatus(403);
    }
});
// ============================================
// WEBHOOK HANDLER (POST) - PUBLIC
// ============================================
router.post('/', async (req, res) => {
    try {
        const signature = req.headers['x-hub-signature-256'];
        // ✅ IMPORTANT: Respond immediately to Meta
        // Meta expects 200 OK within 20 seconds
        res.sendStatus(200);
        // Process webhook asynchronously
        setImmediate(async () => {
            try {
                await webhook_service_1.webhookService.processWebhook(req.body, signature);
            }
            catch (error) {
                console.error('❌ Async webhook processing error:', error);
            }
        });
    }
    catch (error) {
        console.error('❌ Webhook handler error:', error);
        if (!res.headersSent) {
            res.sendStatus(200);
        }
    }
});
// ============================================
// PROTECTED ROUTES (Admin/Debug)
// ============================================
// Get webhook logs
router.get('/logs', auth_1.authenticate, async (req, res) => {
    try {
        const { page = 1, limit = 50, status, eventType } = req.query;
        const where = {};
        if (status) {
            where.status = status;
        }
        if (eventType) {
            where.eventType = eventType;
        }
        const [logs, total] = await Promise.all([
            database_1.default.webhookLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
                select: {
                    id: true,
                    source: true,
                    eventType: true,
                    status: true,
                    processedAt: true,
                    responseTime: true,
                    errorMessage: true,
                    createdAt: true,
                },
            }),
            database_1.default.webhookLog.count({ where }),
        ]);
        res.json({
            success: true,
            data: logs,
            meta: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit)),
            },
        });
    }
    catch (error) {
        console.error('❌ Error fetching webhook logs:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch logs' });
    }
});
// Manual window expiry (Cron job endpoint)
router.post('/expire-windows', auth_1.authenticate, async (req, res) => {
    try {
        const count = await webhook_service_1.webhookService.expireConversationWindows();
        res.json({ success: true, expired: count });
    }
    catch (error) {
        console.error('❌ Error expiring windows:', error);
        res.status(500).json({ success: false, message: 'Failed to expire windows' });
    }
});
// Manual limit reset (Cron job endpoint)
router.post('/reset-limits', auth_1.authenticate, async (req, res) => {
    try {
        const count = await webhook_service_1.webhookService.resetDailyMessageLimits();
        res.json({ success: true, reset: count });
    }
    catch (error) {
        console.error('❌ Error resetting limits:', error);
        res.status(500).json({ success: false, message: 'Failed to reset limits' });
    }
});
exports.default = router;
//# sourceMappingURL=webhook.routes.js.map