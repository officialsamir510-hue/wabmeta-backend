"use strict";
// src/modules/webhooks/webhook.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const webhook_service_1 = require("./webhook.service");
const router = (0, express_1.Router)();
/**
 * GET /api/webhooks/verify
 * Webhook verification endpoint (for Meta setup)
 */
router.get('/verify', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    console.log('📞 Webhook verification request:', { mode, token });
    const result = webhook_service_1.webhookService.verifyWebhook(mode, token, challenge);
    if (result) {
        res.status(200).send(result);
    }
    else {
        res.status(403).send('Forbidden');
    }
});
/**
 * POST /api/webhooks
 * Receive WhatsApp webhooks
 */
router.post('/', async (req, res) => {
    try {
        // Respond immediately to Meta (required)
        res.status(200).send('EVENT_RECEIVED');
        // Process webhook asynchronously
        const result = await webhook_service_1.webhookService.handleWebhook(req.body);
        // Log webhook
        await webhook_service_1.webhookService.logWebhook(req.body, result.status, result.error || result.reason);
        console.log('Webhook processed:', result);
    }
    catch (error) {
        console.error('Webhook error:', error);
        // Log error
        await webhook_service_1.webhookService.logWebhook(req.body, 'failed', error.message);
    }
});
exports.default = router;
//# sourceMappingURL=webhook.routes.js.map