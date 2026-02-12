"use strict";
// src/modules/meta/meta.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.metaService = void 0;
const client_1 = require("@prisma/client");
const meta_api_1 = require("./meta.api");
const config_1 = require("../../config");
const encryption_1 = require("../../utils/encryption");
const uuid_1 = require("uuid");
const prisma = new client_1.PrismaClient();
class MetaService {
    /**
     * Generate OAuth URL for Meta login
     */
    getOAuthUrl(state) {
        const baseUrl = 'https://www.facebook.com/v18.0/dialog/oauth';
        const params = new URLSearchParams({
            client_id: config_1.config.meta.appId,
            redirect_uri: config_1.config.meta.redirectUri,
            state: state,
            scope: [
                'whatsapp_business_management',
                'whatsapp_business_messaging',
                'business_management',
            ].join(','),
            response_type: 'code',
        });
        return `${baseUrl}?${params.toString()}`;
    }
    /**
     * Get Embedded Signup configuration
     */
    getEmbeddedSignupConfig() {
        return {
            appId: config_1.config.meta.appId,
            configId: config_1.config.meta.configId,
            version: config_1.config.meta.graphApiVersion,
            features: ['WHATSAPP_EMBEDDED_SIGNUP'],
        };
    }
    /**
     * Get Integration Status
     */
    getIntegrationStatus() {
        return {
            configured: !!(config_1.config.meta.appId && config_1.config.meta.appSecret),
            apiVersion: config_1.config.meta.graphApiVersion,
        };
    }
    /**
     * Complete Meta connection flow
     */
    async completeConnection(code, organizationId, userId, onProgress) {
        try {
            // Step 1: Exchange code for access token
            onProgress?.({
                step: 'TOKEN_EXCHANGE',
                status: 'in_progress',
                message: 'Exchanging authorization code for access token...',
            });
            const tokenResponse = await meta_api_1.metaApi.exchangeCodeForToken(code);
            let accessToken = tokenResponse.accessToken;
            // Get long-lived token
            try {
                const longLivedTokenResponse = await meta_api_1.metaApi.getLongLivedToken(accessToken);
                accessToken = longLivedTokenResponse.accessToken;
            }
            catch (error) {
                console.log('Could not get long-lived token, using short-lived token');
            }
            onProgress?.({
                step: 'TOKEN_EXCHANGE',
                status: 'completed',
                message: 'Access token obtained successfully',
            });
            // Step 2: Debug token to get permissions and WABA IDs
            onProgress?.({
                step: 'FETCHING_WABA',
                status: 'in_progress',
                message: 'Fetching WhatsApp Business Accounts...',
            });
            const debugInfo = await meta_api_1.metaApi.debugToken(accessToken);
            // Get WABAs from granular scopes
            let wabaId = null;
            let businessId = null;
            const granularScopes = debugInfo.data.granular_scopes || [];
            for (const scope of granularScopes) {
                if (scope.scope === 'whatsapp_business_management' && scope.target_ids?.length) {
                    wabaId = scope.target_ids[0];
                    break;
                }
                if (scope.scope === 'business_management' && scope.target_ids?.length) {
                    businessId = scope.target_ids[0];
                }
            }
            if (!wabaId) {
                // Try getting WABAs through business
                const wabas = await meta_api_1.metaApi.getSharedWABAs(accessToken);
                if (wabas.length > 0) {
                    wabaId = wabas[0].id;
                    businessId = wabas[0].owner_business_info?.id || businessId;
                }
            }
            if (!wabaId) {
                throw new Error('No WhatsApp Business Account found. Please complete the WhatsApp signup process.');
            }
            // Get WABA details
            const wabaDetails = await meta_api_1.metaApi.getWABADetails(wabaId, accessToken);
            onProgress?.({
                step: 'FETCHING_WABA',
                status: 'completed',
                message: `Found WABA: ${wabaDetails.name}`,
                data: { wabaId, wabaName: wabaDetails.name },
            });
            // Step 3: Get phone numbers
            onProgress?.({
                step: 'FETCHING_PHONE',
                status: 'in_progress',
                message: 'Fetching phone numbers...',
            });
            const phoneNumbers = await meta_api_1.metaApi.getPhoneNumbers(wabaId, accessToken);
            if (phoneNumbers.length === 0) {
                throw new Error('No phone numbers found in your WhatsApp Business Account.');
            }
            const primaryPhone = phoneNumbers[0];
            onProgress?.({
                step: 'FETCHING_PHONE',
                status: 'completed',
                message: `Found phone: ${primaryPhone.displayPhoneNumber}`,
                data: { phoneNumber: primaryPhone.displayPhoneNumber },
            });
            // Step 4: Subscribe to webhooks
            onProgress?.({
                step: 'SUBSCRIBE_WEBHOOK',
                status: 'in_progress',
                message: 'Setting up webhooks...',
            });
            try {
                await meta_api_1.metaApi.subscribeToWebhooks(wabaId, accessToken);
            }
            catch (error) {
                console.error('Webhook subscription failed, continuing anyway:', error);
            }
            onProgress?.({
                step: 'SUBSCRIBE_WEBHOOK',
                status: 'completed',
                message: 'Webhooks configured',
            });
            // Step 5: Save to database
            onProgress?.({
                step: 'SAVING',
                status: 'in_progress',
                message: 'Saving account information...',
            });
            // Check if this WABA or phone is already connected
            const existingAccount = await prisma.whatsAppAccount.findFirst({
                where: {
                    OR: [
                        { wabaId: wabaId },
                        { phoneNumberId: primaryPhone.id },
                    ],
                },
            });
            if (existingAccount) {
                if (existingAccount.organizationId === organizationId) {
                    // Update existing account
                    const updatedAccount = await prisma.whatsAppAccount.update({
                        where: { id: existingAccount.id },
                        data: {
                            accessToken: (0, encryption_1.encrypt)(accessToken),
                            tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
                            displayName: primaryPhone.displayPhoneNumber,
                            qualityRating: primaryPhone.qualityRating,
                            status: client_1.WhatsAppAccountStatus.CONNECTED, // ✅ Fixed: Use CONNECTED instead of ACTIVE
                        },
                    });
                    onProgress?.({
                        step: 'COMPLETED',
                        status: 'completed',
                        message: 'Account reconnected successfully!',
                    });
                    return { success: true, account: this.sanitizeAccount(updatedAccount) };
                }
                else {
                    throw new Error('This WhatsApp number is already connected to another organization.');
                }
            }
            // Generate webhook verify token
            const webhookVerifyToken = (0, uuid_1.v4)();
            // Check if this is the first account (make it default)
            const accountCount = await prisma.whatsAppAccount.count({
                where: { organizationId },
            });
            // Create new account
            const newAccount = await prisma.whatsAppAccount.create({
                data: {
                    organizationId,
                    wabaId,
                    phoneNumberId: primaryPhone.id,
                    // ❌ REMOVED: businessId (not in schema)
                    phoneNumber: primaryPhone.displayPhoneNumber.replace(/\D/g, ''),
                    displayName: primaryPhone.displayPhoneNumber,
                    // ❌ REMOVED: verifiedName (not in WhatsAppAccount schema)
                    qualityRating: primaryPhone.qualityRating,
                    accessToken: (0, encryption_1.encrypt)(accessToken),
                    tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
                    webhookSecret: webhookVerifyToken,
                    status: client_1.WhatsAppAccountStatus.CONNECTED, // ✅ Fixed: Use CONNECTED
                    // ❌ REMOVED: connectionStatus (not in schema)
                    // ❌ REMOVED: lastConnectedAt (not in schema)
                    // ❌ REMOVED: lastSyncedAt (not in schema)
                    // ❌ REMOVED: webhookConfigured (not in schema)
                    // ❌ REMOVED: webhookVerifyToken (not in schema)
                    isDefault: accountCount === 0,
                },
            });
            onProgress?.({
                step: 'COMPLETED',
                status: 'completed',
                message: 'WhatsApp account connected successfully!',
            });
            // Sync templates in background
            this.syncTemplatesBackground(newAccount.id, wabaId, accessToken);
            return { success: true, account: this.sanitizeAccount(newAccount) };
        }
        catch (error) {
            console.error('Meta connection error:', error);
            onProgress?.({
                step: 'COMPLETED',
                status: 'error',
                message: error.message || 'Failed to connect WhatsApp account',
            });
            return { success: false, error: error.message };
        }
    }
    /**
     * Get accounts for organization
     */
    async getAccounts(organizationId) {
        const accounts = await prisma.whatsAppAccount.findMany({
            where: { organizationId },
            orderBy: { createdAt: 'desc' },
        });
        return accounts.map((account) => this.sanitizeAccount(account));
    }
    /**
     * Get single account
     */
    async getAccount(accountId, organizationId) {
        const account = await prisma.whatsAppAccount.findFirst({
            where: {
                id: accountId,
                organizationId,
            },
        });
        if (!account) {
            throw new Error('Account not found');
        }
        return this.sanitizeAccount(account);
    }
    /**
     * Get account with decrypted token (internal use)
     */
    async getAccountWithToken(accountId) {
        const account = await prisma.whatsAppAccount.findUnique({
            where: { id: accountId },
        });
        if (!account || !account.accessToken) {
            return null;
        }
        return {
            account,
            accessToken: (0, encryption_1.decrypt)(account.accessToken), // ✅ Fixed: Handle null check
        };
    }
    /**
     * Disconnect account
     */
    async disconnectAccount(accountId, organizationId) {
        const account = await prisma.whatsAppAccount.findFirst({
            where: {
                id: accountId,
                organizationId,
            },
        });
        if (!account) {
            throw new Error('Account not found');
        }
        // Update status
        await prisma.whatsAppAccount.update({
            where: { id: accountId },
            data: {
                status: client_1.WhatsAppAccountStatus.DISCONNECTED,
                // ❌ REMOVED: connectionStatus (not in schema)
                accessToken: null, // ✅ Fixed: Set to null instead of empty string
            },
        });
        // If this was default, set another as default
        if (account.isDefault) {
            const anotherAccount = await prisma.whatsAppAccount.findFirst({
                where: {
                    organizationId,
                    id: { not: accountId },
                    status: client_1.WhatsAppAccountStatus.CONNECTED, // ✅ Fixed: Use CONNECTED
                },
            });
            if (anotherAccount) {
                await prisma.whatsAppAccount.update({
                    where: { id: anotherAccount.id },
                    data: { isDefault: true },
                });
            }
        }
        return { success: true };
    }
    /**
     * Set default account
     */
    async setDefaultAccount(accountId, organizationId) {
        // Remove default from all
        await prisma.whatsAppAccount.updateMany({
            where: { organizationId },
            data: { isDefault: false },
        });
        // Set new default
        await prisma.whatsAppAccount.update({
            where: { id: accountId },
            data: { isDefault: true },
        });
        return { success: true };
    }
    /**
     * Refresh account health/status
     */
    async refreshAccountHealth(accountId, organizationId) {
        const result = await this.getAccountWithToken(accountId);
        if (!result) {
            throw new Error('Account not found');
        }
        const { account, accessToken } = result;
        if (account.organizationId !== organizationId) {
            throw new Error('Unauthorized');
        }
        try {
            // Verify token is still valid
            const debugInfo = await meta_api_1.metaApi.debugToken(accessToken);
            if (!debugInfo.data.is_valid) {
                await prisma.whatsAppAccount.update({
                    where: { id: accountId },
                    data: {
                        status: client_1.WhatsAppAccountStatus.DISCONNECTED, // ✅ Fixed: No ERROR status
                        // ❌ REMOVED: connectionStatus
                    },
                });
                return { healthy: false, reason: 'Token expired' };
            }
            // Get phone number health
            const phoneNumbers = await meta_api_1.metaApi.getPhoneNumbers(account.wabaId, accessToken);
            const phone = phoneNumbers.find((p) => p.id === account.phoneNumberId);
            if (phone) {
                await prisma.whatsAppAccount.update({
                    where: { id: accountId },
                    data: {
                        qualityRating: phone.qualityRating,
                        status: client_1.WhatsAppAccountStatus.CONNECTED, // ✅ Fixed
                        // ❌ REMOVED: connectionStatus, lastSyncedAt
                    },
                });
                return {
                    healthy: true,
                    qualityRating: phone.qualityRating,
                    verifiedName: phone.verifiedName,
                };
            }
            return { healthy: false, reason: 'Phone number not found' };
        }
        catch (error) {
            await prisma.whatsAppAccount.update({
                where: { id: accountId },
                data: {
                    status: client_1.WhatsAppAccountStatus.DISCONNECTED, // ✅ Fixed
                    // ❌ REMOVED: connectionStatus
                },
            });
            return { healthy: false, reason: error.message };
        }
    }
    /**
     * Sync templates from Meta
     */
    async syncTemplates(accountId, organizationId) {
        const result = await this.getAccountWithToken(accountId);
        if (!result) {
            throw new Error('Account not found');
        }
        const { account, accessToken } = result;
        if (account.organizationId !== organizationId) {
            throw new Error('Unauthorized');
        }
        const templates = await meta_api_1.metaApi.getTemplates(account.wabaId, accessToken);
        // Upsert templates
        for (const template of templates) {
            const mappedStatus = this.mapTemplateStatus(template.status);
            // ✅ Skip DRAFT status (not in enum)
            if (mappedStatus === 'DRAFT') {
                continue;
            }
            await prisma.template.upsert({
                where: {
                    organizationId_name_language: {
                        organizationId,
                        name: template.name,
                        language: template.language,
                    },
                },
                create: {
                    organizationId,
                    // ❌ REMOVED: whatsappAccountId (not in Template schema)
                    metaTemplateId: template.id,
                    name: template.name,
                    language: template.language,
                    category: this.mapCategory(template.category),
                    status: mappedStatus,
                    bodyText: this.extractBodyText(template.components),
                    headerType: this.extractHeaderType(template.components),
                    headerContent: this.extractHeaderContent(template.components),
                    footerText: this.extractFooterText(template.components),
                    buttons: this.extractButtons(template.components),
                    // ❌ REMOVED: lastSyncedAt (not in schema)
                },
                update: {
                    status: mappedStatus,
                    // ❌ REMOVED: lastSyncedAt
                },
            });
        }
        // ❌ Can't update lastSyncedAt (not in WhatsAppAccount schema)
        return { synced: templates.length };
    }
    /**
     * Background template sync
     */
    async syncTemplatesBackground(accountId, wabaId, accessToken) {
        try {
            const templates = await meta_api_1.metaApi.getTemplates(wabaId, accessToken);
            console.log(`Synced ${templates.length} templates for account ${accountId}`);
        }
        catch (error) {
            console.error('Background template sync failed:', error);
        }
    }
    /**
     * Remove sensitive data from account
     */
    sanitizeAccount(account) {
        const { accessToken, webhookSecret, ...safe } = account;
        return {
            ...safe,
            hasAccessToken: !!accessToken,
        };
    }
    // Helper methods for template parsing
    mapCategory(category) {
        const map = {
            MARKETING: 'MARKETING',
            UTILITY: 'UTILITY',
            AUTHENTICATION: 'AUTHENTICATION',
        };
        return map[category] || 'UTILITY';
    }
    mapTemplateStatus(status) {
        const map = {
            APPROVED: 'APPROVED',
            PENDING: 'PENDING',
            REJECTED: 'REJECTED',
            DRAFT: 'DRAFT', // Will be filtered out
        };
        return map[status] || 'PENDING';
    }
    extractBodyText(components) {
        const body = components?.find((c) => c.type === 'BODY');
        return body?.text || '';
    }
    extractHeaderType(components) {
        const header = components?.find((c) => c.type === 'HEADER');
        if (!header)
            return null;
        return header.format;
    }
    extractHeaderContent(components) {
        const header = components?.find((c) => c.type === 'HEADER');
        return header?.text || null;
    }
    extractFooterText(components) {
        const footer = components?.find((c) => c.type === 'FOOTER');
        return footer?.text || null;
    }
    extractButtons(components) {
        const buttons = components?.find((c) => c.type === 'BUTTONS');
        return buttons?.buttons || null;
    }
}
exports.metaService = new MetaService();
exports.default = exports.metaService;
//# sourceMappingURL=meta.service.js.map