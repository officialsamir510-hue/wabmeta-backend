"use strict";
// src/modules/whatsapp/whatsapp.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const whatsapp_controller_1 = require("./whatsapp.controller");
const auth_1 = require("../../middleware/auth");
const rateLimit_1 = require("../../middleware/rateLimit");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authenticate);
// Rate limit for sending messages
const sendRateLimit = (0, rateLimit_1.rateLimit)({
    windowMs: 60 * 1000, // 1 minute
    max: 60, // 60 messages per minute
    message: 'Too many messages sent. Please wait a moment.',
});
// Send text message
router.post('/send/text', sendRateLimit, whatsapp_controller_1.whatsappController.sendText.bind(whatsapp_controller_1.whatsappController));
// Send template message
router.post('/send/template', sendRateLimit, whatsapp_controller_1.whatsappController.sendTemplate.bind(whatsapp_controller_1.whatsappController));
// Send media message
router.post('/send/media', sendRateLimit, whatsapp_controller_1.whatsappController.sendMedia.bind(whatsapp_controller_1.whatsappController));
// Mark message as read
router.post('/read', whatsapp_controller_1.whatsappController.markAsRead.bind(whatsapp_controller_1.whatsappController));
exports.default = router;
//# sourceMappingURL=whatsapp.routes.js.map