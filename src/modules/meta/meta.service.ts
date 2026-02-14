// src/modules/meta/meta.service.ts

import {
  PrismaClient,
  WhatsAppAccountStatus,
  TemplateStatus,
  TemplateCategory,
} from '@prisma/client';
import { metaApi } from './meta.api';
import { config } from '../../config';
import {
  encrypt,
  safeDecryptStrict,
  maskToken,
  isMetaToken,
} from '../../utils/encryption';
import { v4 as uuidv4 } from 'uuid';
import { ConnectionProgress } from './meta.types';

const prisma = new PrismaClient();

class MetaService {
  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Check if a string looks like a Meta access token
   */
  private looksLikeAccessToken(value: string): boolean {
    return isMetaToken(value);
  }

  /**
   * Remove sensitive data from account object
   */
  private sanitizeAccount(account: any) {
    if (!account) return null;

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
  getOAuthUrl(state: string): string {
    const version = config.meta.graphApiVersion || 'v21.0';
    const baseUrl = `https://www.facebook.com/${version}/dialog/oauth`;

    const params = new URLSearchParams({
      client_id: config.meta.appId,
      config_id: config.meta.configId,
      response_type: 'code',
      override_default_response_type: 'true',
      state: state,
      redirect_uri: config.meta.redirectUri,
      scope: [
        'whatsapp_business_management',
        'whatsapp_business_messaging',
        'business_management',
      ].join(','),
    });

    const url = `${baseUrl}?${params.toString()}`;

    console.log('📱 Generated OAuth URL');
    console.log('   App ID:', config.meta.appId);
    console.log('   Config ID:', config.meta.configId);
    console.log('   Redirect URI:', config.meta.redirectUri);

    return url;
  }

  /**
   * Get Embedded Signup configuration for frontend
   */
  getEmbeddedSignupConfig() {
    return {
      appId: config.meta.appId,
      configId: config.meta.configId,
      version: config.meta.graphApiVersion || 'v21.0',
      redirectUri: config.meta.redirectUri,
      features: ['WHATSAPP_EMBEDDED_SIGNUP'],
    };
  }

  /**
   * Get Integration Status
   */
  getIntegrationStatus() {
    const isConfigured = !!(
      config.meta.appId &&
      config.meta.appSecret &&
      config.meta.configId &&
      config.meta.redirectUri
    );

    return {
      configured: isConfigured,
      appId: config.meta.appId ? `${config.meta.appId.substring(0, 8)}...` : null,
      hasConfigId: !!config.meta.configId,
      hasRedirectUri: !!config.meta.redirectUri,
      apiVersion: config.meta.graphApiVersion || 'v21.0',
    };
  }

  // ============================================
  // CONNECTION FLOW
  // ============================================

  /**
   * Complete Meta connection flow
   */
  async completeConnection(
    codeOrToken: string,
    organizationId: string,
    userId: string,
    onProgress?: (progress: ConnectionProgress) => void
  ): Promise<{ success: boolean; account?: any; error?: string }> {
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

      let accessToken: string;

      if (this.looksLikeAccessToken(codeOrToken)) {
        console.log('✅ Received access token directly:', maskToken(codeOrToken));
        accessToken = codeOrToken;
      } else {
        console.log('🔄 Exchanging code for token...');
        try {
          const tokenResponse = await metaApi.exchangeCodeForToken(codeOrToken);
          accessToken = tokenResponse.accessToken;
          console.log('✅ Short-lived token obtained:', maskToken(accessToken));
        } catch (tokenError: any) {
          console.error('❌ Token exchange failed:', tokenError.message);
          throw new Error(`Token exchange failed: ${tokenError.message}`);
        }
      }

      // Try to get long-lived token
      try {
        console.log('🔄 Attempting to get long-lived token...');
        const longLivedTokenResponse = await metaApi.getLongLivedToken(accessToken);
        accessToken = longLivedTokenResponse.accessToken;
        console.log('✅ Long-lived token obtained:', maskToken(accessToken));
        console.log('   Expires in:', longLivedTokenResponse.expiresIn, 'seconds');
      } catch (error) {
        console.log('⚠️ Could not get long-lived token, using short-lived token');
      }

      // VERIFY: Token must start with EAA
      if (!this.looksLikeAccessToken(accessToken)) {
        throw new Error('Invalid access token format received from Meta');
      }

      console.log('✅ Final token to save:', maskToken(accessToken));

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

      const debugInfo = await metaApi.debugToken(accessToken);

      if (!debugInfo.data.is_valid) {
        throw new Error('Access token is invalid or expired');
      }

      console.log('🔍 Token debug info:', {
        app_id: debugInfo.data.app_id,
        is_valid: debugInfo.data.is_valid,
        scopes: debugInfo.data.scopes?.join(', '),
      });

      // Get WABA ID from granular scopes
      let wabaId: string | null = null;
      let businessId: string | null = null;

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
          const wabas = await metaApi.getSharedWABAs(accessToken);
          if (wabas.length > 0) {
            wabaId = wabas[0].id;
            businessId = wabas[0].owner_business_info?.id || businessId;
            console.log('✅ Found WABA from business query:', wabaId);
          }
        } catch (wabaError) {
          console.error('Failed to get WABAs from business:', wabaError);
        }
      }

      if (!wabaId) {
        throw new Error(
          'No WhatsApp Business Account found. Please complete the WhatsApp Business signup process first.'
        );
      }

      // Get WABA details
      const wabaDetails = await metaApi.getWABADetails(wabaId, accessToken);
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

      const phoneNumbers = await metaApi.getPhoneNumbers(wabaId, accessToken);

      if (phoneNumbers.length === 0) {
        throw new Error(
          'No phone numbers found in your WhatsApp Business Account. Please add a phone number first.'
        );
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
        const webhookResult = await metaApi.subscribeToWebhooks(wabaId, accessToken);
        console.log('✅ Webhook subscription:', webhookResult ? 'Success' : 'Already subscribed');
      } catch (webhookError: any) {
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
      console.log('   Plain token starts with:', accessToken.substring(0, 10));

      const encryptedToken = encrypt(accessToken);
      console.log('   Encrypted token length:', encryptedToken.length);
      console.log('   Encrypted token starts with:', encryptedToken.substring(0, 20));

      // ✅ VERIFY ENCRYPTION WORKED
      const verifyDecrypt = safeDecryptStrict(encryptedToken);
      if (verifyDecrypt !== accessToken) {
        console.error('❌ Encryption verification FAILED!');
        console.error('   Original:', maskToken(accessToken));
        console.error('   After decrypt:', verifyDecrypt ? maskToken(verifyDecrypt) : 'NULL');
        throw new Error('Token encryption verification failed');
      }
      console.log('✅ Encryption verified successfully');

      if (existingAccount) {
        // Account exists - check ownership
        if (existingAccount.organizationId !== organizationId) {
          throw new Error(
            'This WhatsApp number is already connected to another organization.'
          );
        }

        // Update existing account
        console.log('🔄 Updating existing account:', existingAccount.id);

        savedAccount = await prisma.whatsAppAccount.update({
          where: { id: existingAccount.id },
          data: {
            accessToken: encryptedToken,
            tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
            displayName: primaryPhone.verifiedName || primaryPhone.displayPhoneNumber,
            qualityRating: primaryPhone.qualityRating,
            status: WhatsAppAccountStatus.CONNECTED,
          },
        });

        console.log('✅ Account reconnected:', savedAccount.id);

        onProgress?.({
          step: 'COMPLETED',
          status: 'completed',
          message: 'Account reconnected successfully!',
        });
      } else {
        // Create new account
        console.log('🔄 Creating new account...');

        const webhookVerifyToken = uuidv4();
        const accountCount = await prisma.whatsAppAccount.count({
          where: { organizationId },
        });
        const cleanPhoneNumber = primaryPhone.displayPhoneNumber.replace(/\D/g, '');
        const encryptedWebhookSecret = encrypt(webhookVerifyToken);

        savedAccount = await prisma.whatsAppAccount.create({
          data: {
            organizationId,
            wabaId,
            phoneNumberId: primaryPhone.id,
            phoneNumber: cleanPhoneNumber,
            displayName: primaryPhone.verifiedName || primaryPhone.displayPhoneNumber,
            qualityRating: primaryPhone.qualityRating,
            accessToken: encryptedToken,
            tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
            webhookSecret: encryptedWebhookSecret,
            status: WhatsAppAccountStatus.CONNECTED,
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
    } catch (error: any) {
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
  async getAccounts(organizationId: string) {
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
  async getAccount(accountId: string, organizationId: string) {
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
  async getAccountWithToken(accountId: string): Promise<{
    account: any;
    accessToken: string;
  } | null> {
    const account = await prisma.whatsAppAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      console.error(`❌ Account not found: ${accountId}`);
      return null;
    }

    if (!account.accessToken) {
      console.error(`❌ No access token for account: ${accountId}`);
      return null;
    }

    console.log(`\n🔐 ========== TOKEN RETRIEVAL ==========`);
    console.log(`   Account ID: ${accountId}`);
    console.log(`   Stored token length: ${account.accessToken.length}`);
    console.log(`   Stored token starts with: ${account.accessToken.substring(0, 20)}...`);

    // ✅ STRICT decrypt: only returns valid Meta tokens
    const decryptedToken = safeDecryptStrict(account.accessToken);

    if (!decryptedToken) {
      console.error(`❌ Failed to decrypt token for account: ${accountId}`);
      console.error(`   This usually means:`);
      console.error(`   1. Token was stored incorrectly (not encrypted)`);
      console.error(`   2. Encryption key changed`);
      console.error(`   3. Token is corrupted`);
      console.error(`   Solution: Reconnect the WhatsApp account`);
      return null;
    }

    // Double-check it's a valid Meta token
    if (!this.looksLikeAccessToken(decryptedToken)) {
      console.error(`❌ Decrypted value is not a valid Meta token`);
      console.error(`   Expected: EAA...`);
      console.error(`   Got: ${maskToken(decryptedToken)}`);
      return null;
    }

    console.log(`✅ Token decrypted successfully: ${maskToken(decryptedToken)}`);
    console.log(`🔐 ========== TOKEN RETRIEVAL END ==========\n`);

    return {
      account,
      accessToken: decryptedToken,
    };
  }

  /**
   * Update account access token
   */
  async updateAccountToken(accountId: string, newToken: string) {
    console.log(`🔐 Encrypting new token for account ${accountId}...`);

    // Verify it's a valid Meta token before encrypting
    if (!this.looksLikeAccessToken(newToken)) {
      throw new Error('Invalid token format: Must start with EAA');
    }

    const encryptedToken = encrypt(newToken);

    await prisma.whatsAppAccount.update({
      where: { id: accountId },
      data: {
        accessToken: encryptedToken,
        tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        status: WhatsAppAccountStatus.CONNECTED,
      },
    });

    console.log(`✅ Token updated for account ${accountId}`);
  }

  /**
   * Disconnect WhatsApp account
   */
  async disconnectAccount(accountId: string, organizationId: string) {
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
        status: WhatsAppAccountStatus.DISCONNECTED,
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
          status: WhatsAppAccountStatus.CONNECTED,
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
  async setDefaultAccount(accountId: string, organizationId: string) {
    const account = await prisma.whatsAppAccount.findFirst({
      where: {
        id: accountId,
        organizationId,
        status: WhatsAppAccountStatus.CONNECTED,
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
  async refreshAccountHealth(accountId: string, organizationId: string) {
    const result = await this.getAccountWithToken(accountId);

    if (!result) {
      throw new Error('Account not found or token unavailable. Please reconnect.');
    }

    const { account, accessToken } = result;

    if (account.organizationId !== organizationId) {
      throw new Error('Unauthorized access to account');
    }

    try {
      const debugInfo = await metaApi.debugToken(accessToken);

      if (!debugInfo.data.is_valid) {
        await prisma.whatsAppAccount.update({
          where: { id: accountId },
          data: {
            status: WhatsAppAccountStatus.DISCONNECTED,
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

      const phoneNumbers = await metaApi.getPhoneNumbers(account.wabaId, accessToken);
      const phone = phoneNumbers.find((p) => p.id === account.phoneNumberId);

      if (!phone) {
        await prisma.whatsAppAccount.update({
          where: { id: accountId },
          data: { status: WhatsAppAccountStatus.DISCONNECTED },
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
          status: WhatsAppAccountStatus.CONNECTED,
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
    } catch (error: any) {
      console.error(`❌ Health check failed for account ${accountId}:`, error);

      await prisma.whatsAppAccount.update({
        where: { id: accountId },
        data: {
          status: WhatsAppAccountStatus.DISCONNECTED,
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
  // TEMPLATE MANAGEMENT
  // ============================================

  async syncTemplates(accountId: string, organizationId: string) {
    const result = await this.getAccountWithToken(accountId);

    if (!result) {
      throw new Error('Account not found or token unavailable');
    }

    const { account, accessToken } = result;

    if (account.organizationId !== organizationId) {
      throw new Error('Unauthorized access to account');
    }

    console.log(`🔄 Syncing templates for account ${accountId}...`);

    const templates = await metaApi.getTemplates(account.wabaId, accessToken);

    let syncedCount = 0;
    let skippedCount = 0;

    for (const template of templates) {
      try {
        const mappedStatus = this.mapTemplateStatus(template.status);

        if (mappedStatus === 'DRAFT') {
          skippedCount++;
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
            metaTemplateId: template.id,
            name: template.name,
            language: template.language,
            category: this.mapCategory(template.category),
            status: mappedStatus as TemplateStatus,
            bodyText: this.extractBodyText(template.components),
            headerType: this.extractHeaderType(template.components),
            headerContent: this.extractHeaderContent(template.components),
            footerText: this.extractFooterText(template.components),
            buttons: this.extractButtons(template.components),
          },
          update: {
            metaTemplateId: template.id,
            status: mappedStatus as TemplateStatus,
            category: this.mapCategory(template.category),
            bodyText: this.extractBodyText(template.components),
            headerType: this.extractHeaderType(template.components),
            headerContent: this.extractHeaderContent(template.components),
            footerText: this.extractFooterText(template.components),
            buttons: this.extractButtons(template.components),
          },
        });

        syncedCount++;
      } catch (templateError: any) {
        console.error(`Failed to sync template ${template.name}:`, templateError.message);
        skippedCount++;
      }
    }

    console.log(`✅ Template sync completed: ${syncedCount} synced, ${skippedCount} skipped`);

    return {
      synced: syncedCount,
      skipped: skippedCount,
      total: templates.length,
    };
  }

  private async syncTemplatesBackground(
    accountId: string,
    wabaId: string,
    accessToken: string
  ) {
    try {
      console.log(`🔄 Background template sync for account ${accountId}...`);

      const templates = await metaApi.getTemplates(wabaId, accessToken);

      const account = await prisma.whatsAppAccount.findUnique({
        where: { id: accountId },
        select: { organizationId: true },
      });

      if (!account) {
        console.error('Account not found for background sync');
        return;
      }

      let syncedCount = 0;

      for (const template of templates) {
        try {
          const mappedStatus = this.mapTemplateStatus(template.status);

          if (mappedStatus === 'DRAFT') continue;

          await prisma.template.upsert({
            where: {
              organizationId_name_language: {
                organizationId: account.organizationId,
                name: template.name,
                language: template.language,
              },
            },
            create: {
              organizationId: account.organizationId,
              metaTemplateId: template.id,
              name: template.name,
              language: template.language,
              category: this.mapCategory(template.category),
              status: mappedStatus as TemplateStatus,
              bodyText: this.extractBodyText(template.components),
              headerType: this.extractHeaderType(template.components),
              headerContent: this.extractHeaderContent(template.components),
              footerText: this.extractFooterText(template.components),
              buttons: this.extractButtons(template.components),
            },
            update: {
              metaTemplateId: template.id,
              status: mappedStatus as TemplateStatus,
            },
          });

          syncedCount++;
        } catch (err) {
          // Silently skip failed templates
        }
      }

      console.log(`✅ Background sync: ${syncedCount}/${templates.length} templates`);
    } catch (error) {
      console.error('❌ Background template sync failed:', error);
    }
  }

  // ============================================
  // TEMPLATE HELPERS
  // ============================================

  private mapCategory(category: string): TemplateCategory {
    const map: Record<string, TemplateCategory> = {
      MARKETING: 'MARKETING',
      UTILITY: 'UTILITY',
      AUTHENTICATION: 'AUTHENTICATION',
    };
    return map[category?.toUpperCase()] || 'UTILITY';
  }

  private mapTemplateStatus(status: string): TemplateStatus | 'DRAFT' {
    const map: Record<string, TemplateStatus | 'DRAFT'> = {
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

  private extractBodyText(components: any[]): string {
    if (!Array.isArray(components)) return '';
    const body = components.find((c) => c.type === 'BODY');
    return body?.text || '';
  }

  private extractHeaderType(
    components: any[]
  ): 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | null {
    if (!Array.isArray(components)) return null;
    const header = components.find((c) => c.type === 'HEADER');
    if (!header) return null;

    const format = header.format?.toUpperCase();
    if (['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'].includes(format)) {
      return format as 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
    }
    return null;
  }

  private extractHeaderContent(components: any[]): string | null {
    if (!Array.isArray(components)) return null;
    const header = components.find((c) => c.type === 'HEADER');
    return header?.text || header?.example?.header_text?.[0] || null;
  }

  private extractFooterText(components: any[]): string | null {
    if (!Array.isArray(components)) return null;
    const footer = components.find((c) => c.type === 'FOOTER');
    return footer?.text || null;
  }

  private extractButtons(components: any[]): any {
    if (!Array.isArray(components)) return null;
    const buttonsComponent = components.find((c) => c.type === 'BUTTONS');
    return buttonsComponent?.buttons || null;
  }
}

export const metaService = new MetaService();
export default metaService;