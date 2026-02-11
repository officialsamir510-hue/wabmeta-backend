"use strict";
// src/modules/webhooks/webhook.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const webhook_service_1 = require("./webhook.service");
const router = (0, express_1.Router)();
// Webhook verification (GET)
router.get('/', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const result = webhook_service_1.webhookService.verifyWebhook(mode, token, challenge);
    if (result) {
        res.status(200).send(result);
    }
    else {
        res.status(403).send('Forbidden');
    }
});
// Webhook receiver (POST)
router.post('/', async (req, res) => {
    try {
        // Always respond 200 immediately to acknowledge receipt
        res.status(200).send('OK');
        // Process webhook asynchronously
        await webhook_service_1.webhookService.processWebhook(req.body);
    }
    catch (error) {
        console.error('[Webhook] Error:', error);
        // Still return 200 to prevent retries
        res.status(200).send('OK');
    }
});
exports.default = router;
//# sourceMappingURL=webhook.routes.js.map