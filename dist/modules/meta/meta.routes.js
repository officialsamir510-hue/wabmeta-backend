"use strict";
// src/modules/meta/meta.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const meta_controller_1 = require("./meta.controller");
const auth_1 = require("../../middleware/auth");
const validate_1 = require("../../middleware/validate");
const meta_schema_1 = require("./meta.schema");
const router = (0, express_1.Router)();
// Public route - Embedded signup config
router.get('/config', meta_controller_1.metaController.getEmbeddedConfig.bind(meta_controller_1.metaController));
router.get('/status', meta_controller_1.metaController.getStatus.bind(meta_controller_1.metaController));
// Protected routes
router.use(auth_1.authenticate);
// OAuth flow
router.get('/oauth-url', meta_controller_1.metaController.getOAuthUrl.bind(meta_controller_1.metaController));
router.post('/callback', (0, validate_1.validate)(meta_schema_1.tokenExchangeSchema), meta_controller_1.metaController.handleCallback.bind(meta_controller_1.metaController));
// Account management
router.get('/organizations/:organizationId/accounts', meta_controller_1.metaController.getAccounts.bind(meta_controller_1.metaController));
router.get('/organizations/:organizationId/accounts/:accountId', meta_controller_1.metaController.getAccount.bind(meta_controller_1.metaController));
router.delete('/organizations/:organizationId/accounts/:accountId', meta_controller_1.metaController.disconnectAccount.bind(meta_controller_1.metaController));
router.post('/organizations/:organizationId/accounts/:accountId/default', meta_controller_1.metaController.setDefaultAccount.bind(meta_controller_1.metaController));
router.post('/organizations/:organizationId/accounts/:accountId/health', meta_controller_1.metaController.refreshHealth.bind(meta_controller_1.metaController));
router.post('/organizations/:organizationId/accounts/:accountId/sync-templates', meta_controller_1.metaController.syncTemplates.bind(meta_controller_1.metaController));
exports.default = router;
//# sourceMappingURL=meta.routes.js.map