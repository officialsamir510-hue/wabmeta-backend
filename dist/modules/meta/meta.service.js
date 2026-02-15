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
    // ============================================
    // HELPER METHODS
    // ============================================
    /**
     * Check if a string looks like a Meta access token
     */
    looksLikeAccessToken(value) {
        return (0, encryption_1.isMetaToken)(value);
    }
    /**
     * Remove sensitive data from account object
     */
    sanitizeAccount(account) {
        if (!account)
            return null;
        const { accessToken, webhookSecret, ...safe } = account;
        return {
            ...safe,
            hasAccessToken: !!accessToken,
            hasWebhookSecret: !!webhookSecret,
        };
    }
    // ============================================
    // CONFIGURATION METHODS
    // ============================================
    /**
     * Generate OAuth URL for Meta Embedded Signup
     */
    getOAuthUrl(state) {
        const version = config_1.config.meta.graphApiVersion || 'v21.0';
        const baseUrl = `https://www.facebook.com/${version}/dialog/oauth`;
        const params = new URLSearchParams({
            client_id: config_1.config.meta.appId,
            config_id: config_1.config.meta.configId,
            response_type: 'code',
            override_default_response_type: 'true',
            state: state,
            redirect_uri: config_1.config.meta.redirectUri,
            scope: [
                'whatsapp_business_management',
                'whatsapp_business_messaging',
                'business_management',
            ].join(','),
        });
        const url = `${baseUrl}?${params.toString()}`;
        console.log('📱 Generated OAuth URL');
        console.log('   App ID:', config_1.config.meta.appId);
        console.log('   Config ID:', config_1.config.meta.configId);
        console.log('   Redirect URI:', config_1.config.meta.redirectUri);
        return url;
    }
    /**
     * Get Embedded Signup configuration for frontend
     */
    getEmbeddedSignupConfig() {
        return {
            appId: config_1.config.meta.appId,
            configId: config_1.config.meta.configId,
            version: config_1.config.meta.graphApiVersion || 'v21.0',
            redirectUri: config_1.config.meta.redirectUri,
            features: ['WHATSAPP_EMBEDDED_SIGNUP'],
        };
    }
    /**
     * Get Integration Status
     */
    getIntegrationStatus() {
        const isConfigured = !!(config_1.config.meta.appId &&
            config_1.config.meta.appSecret &&
            config_1.config.meta.configId &&
            config_1.config.meta.redirectUri);
        return {
            configured: isConfigured,
            appId: config_1.config.meta.appId ? `${config_1.config.meta.appId.substring(0, 8)}...` : null,
            hasConfigId: !!config_1.config.meta.configId,
            hasRedirectUri: !!config_1.config.meta.redirectUri,
            apiVersion: config_1.config.meta.graphApiVersion || 'v21.0',
        };
    }
    // ============================================
    // CONNECTION FLOW
    // ============================================
    /**
     * Complete Meta connection flow
     */
    async completeConnection(codeOrToken, organizationId, userId, onProgress) {
        try {
            console.log('\n🔄 ========== META CONNECTION START ==========');
            console.log('   Organization ID:', organizationId);
            console.log('   User ID:', userId);
            console.log('   Input type:', this.looksLikeAccessToken(codeOrToken) ? 'Access Token' : 'Auth Code');
            // ============================================
            // STEP 1: Get Access Token
            // ============================================
            onProgress?.({
                step: 'TOKEN_EXCHANGE',
                status: 'in_progress',
                message: 'Exchanging authorization code for access token...',
            });
            let accessToken;
            if (this.looksLikeAccessToken(codeOrToken)) {
                console.log('✅ Received access token directly:', (0, encryption_1.maskToken)(codeOrToken));
                accessToken = codeOrToken;
            }
            else {
                console.log('🔄 Exchanging code for token...');
                try {
                    const tokenResponse = await meta_api_1.metaApi.exchangeCodeForToken(codeOrToken);
                    accessToken = tokenResponse.accessToken;
                    console.log('✅ Short-lived token obtained:', (0, encryption_1.maskToken)(accessToken));
                }
                catch (tokenError) {
                    console.error('❌ Token exchange failed:', tokenError.message);
                    throw new Error(`Token exchange failed: ${tokenError.message}`);
                }
            }
            // Try to get long-lived token
            try {
                console.log('🔄 Attempting to get long-lived token...');
                const longLivedTokenResponse = await meta_api_1.metaApi.getLongLivedToken(accessToken);
                accessToken = longLivedTokenResponse.accessToken;
                console.log('✅ Long-lived token obtained:', (0, encryption_1.maskToken)(accessToken));
                console.log('   Expires in:', longLivedTokenResponse.expiresIn, 'seconds');
            }
            catch (error) {
                console.log('⚠️ Could not get long-lived token, using short-lived token');
            }
            // VERIFY: Token must start with EAA
            if (!this.looksLikeAccessToken(accessToken)) {
                throw new Error('Invalid access token format received from Meta');
            }
            console.log('✅ Final token to save:', (0, encryption_1.maskToken)(accessToken));
            onProgress?.({
                step: 'TOKEN_EXCHANGE',
                status: 'completed',
                message: 'Access token obtained successfully',
            });
            // ============================================
            // STEP 2: Debug Token & Get WABA
            // ============================================
            onProgress?.({
                step: 'FETCHING_WABA',
                status: 'in_progress',
                message: 'Fetching WhatsApp Business Accounts...',
            });
            const debugInfo = await meta_api_1.metaApi.debugToken(accessToken);
            if (!debugInfo.data.is_valid) {
                throw new Error('Access token is invalid or expired');
            }
            console.log('🔍 Token debug info:', {
                app_id: debugInfo.data.app_id,
                is_valid: debugInfo.data.is_valid,
                scopes: debugInfo.data.scopes?.join(', '),
            });
            // Get WABA ID from granular scopes
            let wabaId = null;
            let businessId = null;
            const granularScopes = debugInfo.data.granular_scopes || [];
            for (const scope of granularScopes) {
                if (scope.scope === 'whatsapp_business_management' && scope.target_ids?.length) {
                    wabaId = scope.target_ids[0];
                    console.log('✅ Found WABA ID from token scopes:', wabaId);
                    break;
                }
                if (scope.scope === 'business_management' && scope.target_ids?.length) {
                    businessId = scope.target_ids[0];
                }
            }
            // If no WABA in token, try business query
            if (!wabaId) {
                console.log('⚠️ WABA not in token scopes, trying business query...');
                try {
                    const wabas = await meta_api_1.metaApi.getSharedWABAs(accessToken);
                    if (wabas.length > 0) {
                        wabaId = wabas[0].id;
                        businessId = wabas[0].owner_business_info?.id || businessId;
                        console.log('✅ Found WABA from business query:', wabaId);
                    }
                }
                catch (wabaError) {
                    console.error('Failed to get WABAs from business:', wabaError);
                }
            }
            if (!wabaId) {
                throw new Error('No WhatsApp Business Account found. Please complete the WhatsApp Business signup process first.');
            }
            // Get WABA details
            const wabaDetails = await meta_api_1.metaApi.getWABADetails(wabaId, accessToken);
            console.log('✅ WABA Details:', {
                id: wabaDetails.id,
                name: wabaDetails.name,
                currency: wabaDetails.currency,
            });
            onProgress?.({
                step: 'FETCHING_WABA',
                status: 'completed',
                message: `Found WABA: ${wabaDetails.name}`,
                data: { wabaId, wabaName: wabaDetails.name },
            });
            // ============================================
            // STEP 3: Get Phone Numbers
            // ============================================
            onProgress?.({
                step: 'FETCHING_PHONE',
                status: 'in_progress',
                message: 'Fetching phone numbers...',
            });
            const phoneNumbers = await meta_api_1.metaApi.getPhoneNumbers(wabaId, accessToken);
            if (phoneNumbers.length === 0) {
                throw new Error('No phone numbers found in your WhatsApp Business Account. Please add a phone number first.');
            }
            const primaryPhone = phoneNumbers[0];
            console.log('✅ Primary Phone:', {
                id: primaryPhone.id,
                number: primaryPhone.displayPhoneNumber,
                qualityRating: primaryPhone.qualityRating,
                verifiedName: primaryPhone.verifiedName,
            });
            onProgress?.({
                step: 'FETCHING_PHONE',
                status: 'completed',
                message: `Found phone: ${primaryPhone.displayPhoneNumber}`,
                data: {
                    phoneNumberId: primaryPhone.id,
                    phoneNumber: primaryPhone.displayPhoneNumber,
                    verifiedName: primaryPhone.verifiedName,
                },
            });
            // ============================================
            // STEP 4: Subscribe to Webhooks
            // ============================================
            onProgress?.({
                step: 'SUBSCRIBE_WEBHOOK',
                status: 'in_progress',
                message: 'Setting up webhooks...',
            });
            try {
                const webhookResult = await meta_api_1.metaApi.subscribeToWebhooks(wabaId, accessToken);
                console.log('✅ Webhook subscription:', webhookResult ? 'Success' : 'Already subscribed');
            }
            catch (webhookError) {
                console.warn('⚠️ Webhook subscription failed:', webhookError.message);
            }
            onProgress?.({
                step: 'SUBSCRIBE_WEBHOOK',
                status: 'completed',
                message: 'Webhooks configured',
            });
            // ============================================
            // STEP 5: Save to Database
            // ============================================
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
            let savedAccount;
            // ✅ ENCRYPT TOKEN BEFORE SAVING
            console.log('🔐 Encrypting token before saving...');
            console.log('   Plain token:', (0, encryption_1.maskToken)(accessToken));
            if (!(0, encryption_1.isMetaToken)(accessToken)) {
                throw new Error('Invalid Meta token format - must start with EAA');
            }
            const encryptedToken = (0, encryption_1.encrypt)(accessToken);
            console.log('   Encrypted token length:', encryptedToken.length);
            console.log('   Encrypted token preview:', encryptedToken.substring(0, 30) + '...');
            // ✅ VERIFY ENCRYPTION WORKED
            const verifyDecrypt = (0, encryption_1.safeDecryptStrict)(encryptedToken);
            if (verifyDecrypt !== accessToken) {
                console.error('❌ Encryption verification FAILED!');
                console.error('   Original:', (0, encryption_1.maskToken)(accessToken));
                console.error('   After decrypt:', verifyDecrypt ? (0, encryption_1.maskToken)(verifyDecrypt) : 'NULL');
                throw new Error('Token encryption verification failed');
            }
            console.log('✅ Encryption verified successfully');
            // Now save to database
            const tokenExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days
            if (existingAccount) {
                // Account exists - check ownership
                if (existingAccount.organizationId !== organizationId) {
                    throw new Error('This WhatsApp number is already connected to another organization.');
                }
                // Update existing account
                console.log('🔄 Updating existing account:', existingAccount.id);
                savedAccount = await prisma.whatsAppAccount.update({
                    where: { id: existingAccount.id },
                    data: {
                        accessToken: encryptedToken,
                        tokenExpiresAt,
                        displayName: primaryPhone.verifiedName || primaryPhone.displayPhoneNumber,
                        qualityRating: primaryPhone.qualityRating,
                        status: client_1.WhatsAppAccountStatus.CONNECTED,
                    },
                });
                console.log('✅ Account reconnected:', savedAccount.id);
                onProgress?.({
                    step: 'COMPLETED',
                    status: 'completed',
                    message: 'Account reconnected successfully!',
                });
            }
            else {
                // Create new account
                console.log('🔄 Creating new account...');
                const accountCount = await prisma.whatsAppAccount.count({
                    where: { organizationId },
                });
                const cleanPhoneNumber = primaryPhone.displayPhoneNumber.replace(/\D/g, '');
                const webhookVerifyToken = (0, uuid_1.v4)();
                const encryptedWebhookSecret = (0, encryption_1.encrypt)(webhookVerifyToken);
                savedAccount = await prisma.whatsAppAccount.create({
                    data: {
                        organizationId,
                        wabaId,
                        phoneNumberId: primaryPhone.id,
                        phoneNumber: cleanPhoneNumber,
                        displayName: primaryPhone.verifiedName || primaryPhone.displayPhoneNumber,
                        qualityRating: primaryPhone.qualityRating,
                        accessToken: encryptedToken,
                        tokenExpiresAt,
                        webhookSecret: encryptedWebhookSecret,
                        status: client_1.WhatsAppAccountStatus.CONNECTED,
                        isDefault: accountCount === 0,
                    },
                });
                console.log('✅ New account created:', savedAccount.id);
                onProgress?.({
                    step: 'COMPLETED',
                    status: 'completed',
                    message: 'WhatsApp account connected successfully!',
                });
            }
            // Sync templates in background
            this.syncTemplatesBackground(savedAccount.id, wabaId, accessToken).catch((err) => {
                console.error('Background template sync failed:', err);
            });
            console.log('🔄 ========== META CONNECTION END ==========\n');
            return {
                success: true,
                account: this.sanitizeAccount(savedAccount),
            };
        }
        catch (error) {
            console.error('❌ Meta connection error:', error);
            onProgress?.({
                step: 'COMPLETED',
                status: 'error',
                message: error.message || 'Failed to connect WhatsApp account',
            });
            return {
                success: false,
                error: error.message || 'Failed to connect WhatsApp account',
            };
        }
    }
    // ============================================
    // ACCOUNT MANAGEMENT
    // ============================================
    /**
     * Get all accounts for organization
     */
    async getAccounts(organizationId) {
        const accounts = await prisma.whatsAppAccount.findMany({
            where: { organizationId },
            orderBy: [
                { isDefault: 'desc' },
                { createdAt: 'desc' },
            ],
        });
        return accounts.map((account) => this.sanitizeAccount(account));
    }
    /**
     * Get single account by ID
     */
    async getAccount(accountId, organizationId) {
        const account = await prisma.whatsAppAccount.findFirst({
            where: {
                id: accountId,
                organizationId,
            },
        });
        if (!account) {
            throw new Error('WhatsApp account not found');
        }
        return this.sanitizeAccount(account);
    }
    /**
     * Get account with decrypted token (internal use only) - ✅ FIXED
     */
    async getAccountWithToken(accountId) {
        const account = await prisma.whatsAppAccount.findUnique({
            where: { id: accountId },
        });
        if (!account) {
            console.error(`❌ Account not found: ${accountId}`);
            return null;
        }
        if (!account.accessToken) {
            console.error(`❌ No access token stored for account: ${accountId}`);
            return null;
        }
        console.log(`\n🔐 ========== TOKEN RETRIEVAL ==========`);
        console.log(`   Account ID: ${accountId}`);
        console.log(`   Organization: ${account.organizationId}`);
        console.log(`   Phone: ${account.phoneNumber}`);
        console.log(`   Stored encrypted token length: ${account.accessToken.length}`);
        console.log(`   Stored token preview: ${account.accessToken.substring(0, 30)}...`);
        // ✅ STRICT decrypt: only returns valid Meta tokens
        const decryptedToken = (0, encryption_1.safeDecryptStrict)(account.accessToken);
        if (!decryptedToken) {
            console.error(`❌ Failed to decrypt token for account: ${accountId}`);
            console.error(`   Possible reasons:`);
            console.error(`   1. Token was saved incorrectly (not encrypted properly)`);
            console.error(`   2. Encryption key changed in .env (ENCRYPTION_KEY)`);
            console.error(`   3. Database corruption`);
            console.error(`   4. Token format changed`);
            console.error(`\n   ✅ SOLUTION: Reconnect WhatsApp account from Settings`);
            return null;
        }
        console.log(`✅ Token decrypted successfully`);
        console.log(`   Decrypted token: ${(0, encryption_1.maskToken)(decryptedToken)}`);
        console.log(`   Token is valid Meta format: ${(0, encryption_1.isMetaToken)(decryptedToken)}`);
        console.log(`🔐 ========== TOKEN RETRIEVAL END ==========\n`);
        return {
            account,
            accessToken: decryptedToken,
        };
    }
    /**
     * Update account access token
     */
    async updateAccountToken(accountId, newToken) {
        console.log(`🔐 Encrypting new token for account ${accountId}...`);
        // Verify it's a valid Meta token before encrypting
        if (!this.looksLikeAccessToken(newToken)) {
            throw new Error('Invalid token format: Must start with EAA');
        }
        const encryptedToken = (0, encryption_1.encrypt)(newToken);
        await prisma.whatsAppAccount.update({
            where: { id: accountId },
            data: {
                accessToken: encryptedToken,
                tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
                status: client_1.WhatsAppAccountStatus.CONNECTED,
            },
        });
        console.log(`✅ Token updated for account ${accountId}`);
    }
    /**
     * Disconnect WhatsApp account
     */
    async disconnectAccount(accountId, organizationId) {
        const account = await prisma.whatsAppAccount.findFirst({
            where: {
                id: accountId,
                organizationId,
            },
        });
        if (!account) {
            throw new Error('WhatsApp account not found');
        }
        await prisma.whatsAppAccount.update({
            where: { id: accountId },
            data: {
                status: client_1.WhatsAppAccountStatus.DISCONNECTED,
                accessToken: null,
                tokenExpiresAt: null,
            },
        });
        console.log(`✅ Account disconnected: ${accountId}`);
        // If this was default, set another as default
        if (account.isDefault) {
            const anotherAccount = await prisma.whatsAppAccount.findFirst({
                where: {
                    organizationId,
                    id: { not: accountId },
                    status: client_1.WhatsAppAccountStatus.CONNECTED,
                },
                orderBy: { createdAt: 'asc' },
            });
            if (anotherAccount) {
                await prisma.whatsAppAccount.update({
                    where: { id: anotherAccount.id },
                    data: { isDefault: true },
                });
                console.log(`✅ New default account set: ${anotherAccount.id}`);
            }
        }
        return { success: true, message: 'Account disconnected successfully' };
    }
    /**
     * Set account as default
     */
    async setDefaultAccount(accountId, organizationId) {
        const account = await prisma.whatsAppAccount.findFirst({
            where: {
                id: accountId,
                organizationId,
                status: client_1.WhatsAppAccountStatus.CONNECTED,
            },
        });
        if (!account) {
            throw new Error('WhatsApp account not found or not connected');
        }
        await prisma.whatsAppAccount.updateMany({
            where: { organizationId },
            data: { isDefault: false },
        });
        await prisma.whatsAppAccount.update({
            where: { id: accountId },
            data: { isDefault: true },
        });
        console.log(`✅ Default account set: ${accountId}`);
        return { success: true, message: 'Default account updated' };
    }
    // ============================================
    // HEALTH & STATUS
    // ============================================
    /**
     * Refresh account health/status from Meta
     */
    async refreshAccountHealth(accountId, organizationId) {
        const result = await this.getAccountWithToken(accountId);
        if (!result) {
            throw new Error('Account not found or token unavailable. Please reconnect.');
        }
        const { account, accessToken } = result;
        if (account.organizationId !== organizationId) {
            throw new Error('Unauthorized access to account');
        }
        try {
            const debugInfo = await meta_api_1.metaApi.debugToken(accessToken);
            if (!debugInfo.data.is_valid) {
                await prisma.whatsAppAccount.update({
                    where: { id: accountId },
                    data: {
                        status: client_1.WhatsAppAccountStatus.DISCONNECTED,
                        accessToken: null,
                        tokenExpiresAt: null,
                    },
                });
                return {
                    healthy: false,
                    reason: 'Access token expired or invalid',
                    action: 'Please reconnect your WhatsApp account',
                };
            }
            const phoneNumbers = await meta_api_1.metaApi.getPhoneNumbers(account.wabaId, accessToken);
            const phone = phoneNumbers.find((p) => p.id === account.phoneNumberId);
            if (!phone) {
                await prisma.whatsAppAccount.update({
                    where: { id: accountId },
                    data: { status: client_1.WhatsAppAccountStatus.DISCONNECTED },
                });
                return {
                    healthy: false,
                    reason: 'Phone number not found in WABA',
                    action: 'Phone number may have been removed',
                };
            }
            await prisma.whatsAppAccount.update({
                where: { id: accountId },
                data: {
                    qualityRating: phone.qualityRating,
                    displayName: phone.verifiedName || phone.displayPhoneNumber,
                    status: client_1.WhatsAppAccountStatus.CONNECTED,
                },
            });
            console.log(`✅ Health check passed for account ${accountId}`);
            return {
                healthy: true,
                qualityRating: phone.qualityRating,
                verifiedName: phone.verifiedName,
                displayPhoneNumber: phone.displayPhoneNumber,
                status: phone.status,
            };
        }
        catch (error) {
            console.error(`❌ Health check failed for account ${accountId}:`, error);
            await prisma.whatsAppAccount.update({
                where: { id: accountId },
                data: {
                    status: client_1.WhatsAppAccountStatus.DISCONNECTED,
                    accessToken: null,
                    tokenExpiresAt: null,
                },
            });
            return {
                healthy: false,
                reason: error.message || 'Health check failed',
                action: 'Please reconnect your WhatsApp account',
            };
        }
    }
    // ============================================
    // TEMPLATE MANAGEMENT - FIXED
    // ============================================
    async syncTemplates(accountId, organizationId) {
        const result = await this.getAccountWithToken(accountId);
        if (!result) {
            throw new Error('Account not found or token unavailable');
        }
        const { account, accessToken } = result;
        if (account.organizationId !== organizationId) {
            throw new Error('Unauthorized access to account');
        }
        console.log(`🔄 Syncing templates for WABA ${account.wabaId}...`);
        // ✅ STEP 1: Fetch templates from Meta
        const templates = await meta_api_1.metaApi.getTemplates(account.wabaId, accessToken);
        console.log(`📥 Fetched ${templates.length} templates from Meta`);
        // ✅ STEP 2: Get existing templates for organization
        const existingTemplates = await prisma.template.findMany({
            where: {
                organizationId,
                // Removed wabaId filter as templates are organization-wide
            },
            select: {
                id: true,
                name: true,
                language: true,
                metaTemplateId: true,
            },
        });
        const existingMap = new Map(existingTemplates.map(t => [`${t.name}_${t.language}`, t]));
        // ✅ STEP 3: Track which templates are in Meta
        const metaTemplateKeys = new Set();
        let syncedCount = 0;
        let createdCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        for (const template of templates) {
            try {
                const mappedStatus = this.mapTemplateStatus(template.status);
                // Skip draft templates
                if (mappedStatus === 'DRAFT') {
                    skippedCount++;
                    continue;
                }
                const templateKey = `${template.name}_${template.language}`;
                metaTemplateKeys.add(templateKey);
                const existing = existingMap.get(templateKey);
                const templateData = {
                    organizationId,
                    // Removed whatsappAccountId and wabaId
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
                    variables: this.extractVariables(template.components),
                };
                if (existing) {
                    // Update existing
                    await prisma.template.update({
                        where: { id: existing.id },
                        data: templateData,
                    });
                    updatedCount++;
                }
                else {
                    // Create new
                    await prisma.template.create({
                        data: templateData,
                    });
                    createdCount++;
                }
                syncedCount++;
            }
            catch (templateError) {
                console.error(`Failed to sync template ${template.name}:`, templateError.message);
                skippedCount++;
            }
        }
        // ✅ STEP 4: Mark templates not in Meta as deleted/hidden
        // (Templates that exist in DB but not in Meta API response)
        // Note: Since we are syncing for ONE specific account but templates are shared,
        // deleting templates that are not in THIS account's list might be dangerous if they belong to another account?
        // BUT, we earlier said templates are org-wide. So if they are in the org, they should be in the list?
        // Wait, if an org has multiple WABAs, `getTemplates` only returns for one WABA.
        // If we delete templates not in this WABA, we might delete templates from another WABA!
        // Danger!
        // So we should NOT delete templates here unless we are sure they were supposed to be from this WABA.
        // But we don't store WABA ID anymore.
        // So we cannot know which WABA a template "belongs" to.
        // This logic of "deleting missing templates" is flawed in a shared model.
        // We should SKIP the deletion step or make it very specific (e.g. only if metaTemplateId matches?).
        // Actually, if we don't delete, we are fine.
        // Safety: disabling deletion for now to prevent data loss across multiple WABAs.
        /*
        const templatesToRemove = existingTemplates.filter(
          t => !metaTemplateKeys.has(`${t.name}_${t.language}`)
        );
    
        if (templatesToRemove.length > 0) {
          console.log(`🗑️ Removing ${templatesToRemove.length} templates not found in Meta`);
    
          await prisma.template.deleteMany({
            where: {
              id: { in: templatesToRemove.map(t => t.id) },
            },
          });
        }
        */
        const removedCount = 0; // templatesToRemove.length;
        console.log(`✅ Template sync completed for WABA ${account.wabaId}:`);
        console.log(`   Created: ${createdCount}`);
        console.log(`   Updated: ${updatedCount}`);
        console.log(`   Skipped: ${skippedCount}`);
        console.log(`   Removed: ${removedCount}`);
        return {
            synced: syncedCount,
            created: createdCount,
            updated: updatedCount,
            skipped: skippedCount,
            removed: removedCount,
            total: templates.length,
        };
    }
    // ✅ Extract variables from template components
    extractVariables(components) {
        if (!Array.isArray(components))
            return [];
        const variables = [];
        for (const component of components) {
            if (component.type === 'BODY' && component.text) {
                // Find {{1}}, {{2}}, etc.
                const matches = component.text.match(/\{\{(\d+)\}\}/g);
                if (matches) {
                    matches.forEach((match, index) => {
                        variables.push({
                            index: index + 1,
                            type: 'text',
                            placeholder: match,
                        });
                    });
                }
            }
        }
        return variables;
    }
    // ✅ Background sync - UPDATED
    async syncTemplatesBackground(accountId, wabaId, accessToken) {
        try {
            console.log(`🔄 Background template sync for WABA ${wabaId}...`);
            const templates = await meta_api_1.metaApi.getTemplates(wabaId, accessToken);
            const account = await prisma.whatsAppAccount.findUnique({
                where: { id: accountId },
                select: { organizationId: true, id: true },
            });
            if (!account) {
                console.error('Account not found for background sync');
                return;
            }
            // Note: We do NOT delete old templates anymore to prevent data loss.
            // We upsert instead.
            let syncedCount = 0;
            for (const template of templates) {
                try {
                    const mappedStatus = this.mapTemplateStatus(template.status);
                    if (mappedStatus === 'DRAFT')
                        continue;
                    // Check if exists
                    const existing = await prisma.template.findFirst({
                        where: {
                            organizationId: account.organizationId,
                            name: template.name,
                            language: template.language,
                        }
                    });
                    const templateData = {
                        organizationId: account.organizationId,
                        // whatsappAccountId / wabaId removed
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
                        variables: this.extractVariables(template.components),
                    };
                    if (existing) {
                        await prisma.template.update({
                            where: { id: existing.id },
                            data: templateData,
                        });
                    }
                    else {
                        await prisma.template.create({
                            data: templateData
                        });
                    }
                    syncedCount++;
                }
                catch (err) {
                    console.error(`Background sync error for ${template.name}:`, err.message);
                }
            }
            console.log(`✅ Background sync: ${syncedCount}/${templates.length} templates for WABA ${wabaId}`);
        }
        catch (error) {
            console.error('❌ Background template sync failed:', error);
        }
    }
    // ============================================
    // TEMPLATE HELPERS
    // ============================================
    mapCategory(category) {
        const map = {
            MARKETING: 'MARKETING',
            UTILITY: 'UTILITY',
            AUTHENTICATION: 'AUTHENTICATION',
        };
        return map[category?.toUpperCase()] || 'UTILITY';
    }
    mapTemplateStatus(status) {
        const map = {
            APPROVED: 'APPROVED',
            PENDING: 'PENDING',
            REJECTED: 'REJECTED',
            DRAFT: 'DRAFT',
            IN_APPEAL: 'PENDING',
            PENDING_DELETION: 'REJECTED',
            DELETED: 'REJECTED',
            DISABLED: 'REJECTED',
            PAUSED: 'APPROVED',
            LIMIT_EXCEEDED: 'REJECTED',
        };
        return map[status?.toUpperCase()] || 'PENDING';
    }
    extractBodyText(components) {
        if (!Array.isArray(components))
            return '';
        const body = components.find((c) => c.type === 'BODY');
        return body?.text || '';
    }
    extractHeaderType(components) {
        if (!Array.isArray(components))
            return null;
        const header = components.find((c) => c.type === 'HEADER');
        if (!header)
            return null;
        const format = header.format?.toUpperCase();
        if (['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'].includes(format)) {
            return format;
        }
        return null;
    }
    extractHeaderContent(components) {
        if (!Array.isArray(components))
            return null;
        const header = components.find((c) => c.type === 'HEADER');
        return header?.text || header?.example?.header_text?.[0] || null;
    }
    extractFooterText(components) {
        if (!Array.isArray(components))
            return null;
        const footer = components.find((c) => c.type === 'FOOTER');
        return footer?.text || null;
    }
    extractButtons(components) {
        if (!Array.isArray(components))
            return null;
        const buttonsComponent = components.find((c) => c.type === 'BUTTONS');
        return buttonsComponent?.buttons || null;
    }
}
exports.metaService = new MetaService();
exports.default = exports.metaService;
//# sourceMappingURL=meta.service.js.map