// 📁 src/modules/meta/meta.service.ts - COMPLETE FIXED VERSION

import {
  PrismaClient,
  WhatsAppAccountStatus,
  TemplateStatus,
  TemplateCategory,
  WhatsAppAccount,
} from '@prisma/client';
import { metaApi } from './meta.api';
import { config } from '../../config';
import { encrypt, safeDecryptStrict, maskToken, isMetaToken } from '../../utils/encryption';
import { v4 as uuidv4 } from 'uuid';
import { ConnectionProgress } from './meta.types';
import { AppError } from '../../middleware/errorHandler';

const prisma = new PrismaClient();

export class MetaService {
  // ============================================
  // HELPER METHODS
  // ============================================

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
  // OAUTH & CONFIGURATION
  // ============================================

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

    return url;
  }

  getEmbeddedSignupConfig() {
    return {
      appId: config.meta.appId,
      configId: config.meta.configId,
      version: config.meta.graphApiVersion || 'v21.0',
      redirectUri: config.meta.redirectUri,
      features: ['WHATSAPP_EMBEDDED_SIGNUP'],
    };
  }

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

      // ============================================
      // STEP 1: Get Access Token
      // ============================================
      onProgress?.({
        step: 'TOKEN_EXCHANGE',
        status: 'in_progress',
        message: 'Exchanging authorization code...',
      });

      let accessToken: string;

      if (isMetaToken(codeOrToken)) {
        console.log('✅ Using provided access token');
        accessToken = codeOrToken;
      } else {
        console.log('🔄 Exchanging code for token...');
        const tokenResponse = await metaApi.exchangeCodeForToken(codeOrToken);
        accessToken = tokenResponse.accessToken;
        console.log('✅ Short-lived token obtained');
      }

      // Try to get long-lived token
      try {
        console.log('🔄 Getting long-lived token...');
        const longLivedTokenResponse = await metaApi.getLongLivedToken(accessToken);
        accessToken = longLivedTokenResponse.accessToken;
        console.log('✅ Long-lived token obtained');
      } catch (error) {
        console.log('⚠️ Using short-lived token');
      }

      if (!isMetaToken(accessToken)) {
        throw new AppError('Invalid access token format received', 500);
      }

      console.log('✅ Final token:', maskToken(accessToken));

      onProgress?.({
        step: 'TOKEN_EXCHANGE',
        status: 'completed',
        message: 'Access token obtained',
      });

      // ============================================
      // STEP 2: Debug Token & Get WABA
      // ============================================
      onProgress?.({
        step: 'FETCHING_WABA',
        status: 'in_progress',
        message: 'Fetching WhatsApp Business Account...',
      });

      const debugInfo = await metaApi.debugToken(accessToken);

      if (!debugInfo.data.is_valid) {
        throw new AppError('Access token is invalid or expired', 401);
      }

      console.log('🔍 Token is valid');

      // Get WABA ID
      let wabaId: string | null = null;
      let businessId: string | null = null;

      const granularScopes = debugInfo.data.granular_scopes || [];

      for (const scope of granularScopes) {
        if (scope.scope === 'whatsapp_business_management' && scope.target_ids?.length) {
          wabaId = scope.target_ids[0];
          console.log('✅ Found WABA ID:', wabaId);
          break;
        }
        if (scope.scope === 'business_management' && scope.target_ids?.length) {
          businessId = scope.target_ids[0];
        }
      }

      // Fallback: try business query
      if (!wabaId) {
        console.log('⚠️ WABA not in token, querying business...');
        const wabas = await metaApi.getSharedWABAs(accessToken);
        if (wabas.length > 0) {
          wabaId = wabas[0].id;
          businessId = wabas[0].owner_business_info?.id || businessId;
          console.log('✅ Found WABA from business:', wabaId);
        }
      }

      if (!wabaId) {
        throw new AppError('No WhatsApp Business Account found', 404);
      }

      // Get WABA details
      const wabaDetails = await metaApi.getWABADetails(wabaId, accessToken);
      console.log('✅ WABA Details:', {
        id: wabaDetails.id,
        name: wabaDetails.name,
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
        throw new AppError('No phone numbers found', 404);
      }

      const primaryPhone = phoneNumbers[0];
      console.log('✅ Primary Phone:', primaryPhone.displayPhoneNumber);

      onProgress?.({
        step: 'FETCHING_PHONE',
        status: 'completed',
        message: `Found phone: ${primaryPhone.displayPhoneNumber}`,
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
        await metaApi.subscribeToWebhooks(wabaId, accessToken);
        console.log('✅ Webhooks subscribed');
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
        message: 'Saving account...',
      });

      // Check existing
      const existingAccount = await prisma.whatsAppAccount.findFirst({
        where: {
          OR: [{ wabaId }, { phoneNumberId: primaryPhone.id }],
        },
      });

      console.log('🔐 Encrypting token...');
      const encryptedToken = encrypt(accessToken);

      // Verify encryption
      const verifyDecrypt = safeDecryptStrict(encryptedToken);
      if (verifyDecrypt !== accessToken) {
        throw new AppError('Token encryption verification failed', 500);
      }
      console.log('✅ Encryption verified');

      const tokenExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days
      const cleanPhoneNumber = primaryPhone.displayPhoneNumber.replace(/\D/g, '');

      let savedAccount;

      if (existingAccount) {
        // Reconnect existing
        if (existingAccount.organizationId !== organizationId) {
          throw new AppError('This number is already connected to another organization', 409);
        }

        console.log('🔄 Reconnecting existing account');

        savedAccount = await prisma.whatsAppAccount.update({
          where: { id: existingAccount.id },
          data: {
            accessToken: encryptedToken,
            tokenExpiresAt,
            displayName: primaryPhone.verifiedName || primaryPhone.displayPhoneNumber,
            verifiedName: primaryPhone.verifiedName,
            qualityRating: primaryPhone.qualityRating,
            status: WhatsAppAccountStatus.CONNECTED,
            codeVerificationStatus: primaryPhone.codeVerificationStatus,
            nameStatus: primaryPhone.nameStatus,
            messagingLimit: primaryPhone.messagingLimitTier,
          } as any,
        });

        console.log('✅ Account reconnected');
      } else {
        // Create new
        console.log('🔄 Creating new account');

        const accountCount = await prisma.whatsAppAccount.count({
          where: { organizationId },
        });

        const webhookVerifyToken = uuidv4();
        const encryptedWebhookSecret = encrypt(webhookVerifyToken);

        savedAccount = await prisma.whatsAppAccount.create({
          data: {
            organizationId,
            wabaId,
            phoneNumberId: primaryPhone.id,
            phoneNumber: cleanPhoneNumber,
            displayName: primaryPhone.verifiedName || primaryPhone.displayPhoneNumber,
            verifiedName: primaryPhone.verifiedName,
            qualityRating: primaryPhone.qualityRating,
            accessToken: encryptedToken,
            tokenExpiresAt,
            webhookSecret: encryptedWebhookSecret,
            status: WhatsAppAccountStatus.CONNECTED,
            isDefault: accountCount === 0,
            codeVerificationStatus: primaryPhone.codeVerificationStatus,
            nameStatus: primaryPhone.nameStatus,
            messagingLimit: primaryPhone.messagingLimitTier,
          } as any,
        });

        console.log('✅ New account created');
      }

      onProgress?.({
        step: 'COMPLETED',
        status: 'completed',
        message: 'WhatsApp account connected!',
      });

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
        message: error.message || 'Failed to connect',
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

  async getAccounts(organizationId: string) {
    const accounts = await prisma.whatsAppAccount.findMany({
      where: { organizationId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return accounts.map((account) => this.sanitizeAccount(account));
  }

  async getAccount(accountId: string, organizationId: string) {
    const account = await prisma.whatsAppAccount.findFirst({
      where: {
        id: accountId,
        organizationId,
      },
    });

    if (!account) {
      throw new AppError('WhatsApp account not found', 404);
    }

    return this.sanitizeAccount(account);
  }

  async getAccountWithToken(accountId: string): Promise<{
    account: WhatsAppAccount;
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
    console.log(`   Organization: ${account.organizationId}`);
    console.log(`   Phone: ${account.phoneNumber}`);

    const decryptedToken = safeDecryptStrict(account.accessToken);

    if (!decryptedToken || !isMetaToken(decryptedToken)) {
      console.error(`❌ Failed to decrypt token for account: ${accountId}`);
      console.error(`   Possible causes:`);
      console.error(`   1. Token was not encrypted properly`);
      console.error(`   2. ENCRYPTION_KEY changed in .env`);
      console.error(`   3. Database corruption`);
      console.error(`\n   ✅ SOLUTION: Reconnect WhatsApp account`);

      await prisma.whatsAppAccount.update({
        where: { id: accountId },
        data: {
          status: WhatsAppAccountStatus.DISCONNECTED,
          accessToken: null,
        },
      });

      return null;
    }

    console.log(`✅ Token decrypted successfully`);
    console.log(`   Token: ${maskToken(decryptedToken)}`);
    console.log(`🔐 ========== TOKEN RETRIEVAL END ==========\n`);

    return {
      account,
      accessToken: decryptedToken,
    };
  }

  async disconnectAccount(accountId: string, organizationId: string) {
    const account = await prisma.whatsAppAccount.findFirst({
      where: {
        id: accountId,
        organizationId,
      },
    });

    if (!account) {
      throw new AppError('WhatsApp account not found', 404);
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
        console.log(`✅ New default account: ${anotherAccount.id}`);
      }
    }

    return { success: true, message: 'Account disconnected' };
  }

  async setDefaultAccount(accountId: string, organizationId: string) {
    const account = await prisma.whatsAppAccount.findFirst({
      where: {
        id: accountId,
        organizationId,
        status: WhatsAppAccountStatus.CONNECTED,
      },
    });

    if (!account) {
      throw new AppError('Account not found or not connected', 404);
    }

    await prisma.whatsAppAccount.updateMany({
      where: { organizationId },
      data: { isDefault: false },
    });

    await prisma.whatsAppAccount.update({
      where: { id: accountId },
      data: { isDefault: true },
    });

    console.log(`✅ Default account: ${accountId}`);

    return { success: true, message: 'Default account updated' };
  }

  async refreshAccountHealth(accountId: string, organizationId: string) {
    const accountData = await this.getAccountWithToken(accountId);
    if (!accountData) {
      throw new AppError('Account not found or access denied', 404);
    }

    if (accountData.account.organizationId !== organizationId) {
      throw new AppError('Account does not belong to this organization', 403);
    }

    const { account, accessToken } = accountData;
    const isValid = await metaApi.validateToken(accessToken);

    const status = isValid ? 'ACTIVE' : 'DISCONNECTED';

    const updated = await prisma.whatsAppAccount.update({
      where: { id: accountId },
      data: {
        status: status as WhatsAppAccountStatus,
      },
    });

    return this.sanitizeAccount(updated);
  }

  // ============================================
  // TEMPLATE SYNC
  // ============================================

  async syncTemplates(accountId: string, organizationId: string) {
    const result = await this.getAccountWithToken(accountId);

    if (!result) {
      throw new AppError('Account not found or token unavailable', 404);
    }

    const { account, accessToken } = result;

    if (account.organizationId !== organizationId) {
      throw new AppError('Unauthorized', 403);
    }

    console.log(`🔄 Syncing templates for account ${accountId} (WABA: ${account.wabaId})`);

    const metaTemplates = await metaApi.getTemplates(account.wabaId, accessToken);
    console.log(`📥 Fetched ${metaTemplates.length} templates from Meta`);

    const existingTemplates = await prisma.template.findMany({
      where: {
        whatsappAccountId: accountId,
      } as any,
      select: {
        id: true,
        name: true,
        language: true,
        metaTemplateId: true,
      },
    });

    const existingMap = new Map(
      existingTemplates.map((t) => [`${t.name}_${t.language}`, t])
    );

    const metaKeys = new Set<string>();
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const metaTemplate of metaTemplates) {
      try {
        const status = this.mapTemplateStatus(metaTemplate.status);

        if (status === 'DRAFT' || status === 'REJECTED') {
          skipped++;
          continue;
        }

        const key = `${metaTemplate.name}_${metaTemplate.language}`;
        metaKeys.add(key);

        const existing = existingMap.get(key);

        const templateData = {
          organizationId,
          whatsappAccountId: accountId,
          wabaId: account.wabaId,
          metaTemplateId: metaTemplate.id,
          name: metaTemplate.name,
          language: metaTemplate.language,
          category: this.mapCategory(metaTemplate.category),
          status: status as TemplateStatus,
          bodyText: this.extractBodyText(metaTemplate.components),
          headerType: this.extractHeaderType(metaTemplate.components),
          headerContent: this.extractHeaderContent(metaTemplate.components),
          footerText: this.extractFooterText(metaTemplate.components),
          buttons: this.extractButtons(metaTemplate.components),
          variables: this.extractVariables(metaTemplate.components),
          qualityScore: metaTemplate.quality_score?.score || null,
        };

        if (existing) {
          await prisma.template.update({
            where: { id: existing.id },
            data: templateData,
          });
          updated++;
        } else {
          await prisma.template.create({ data: templateData });
          created++;
        }
      } catch (err: any) {
        console.error(`Failed to sync ${metaTemplate.name}:`, err.message);
        skipped++;
      }
    }

    const toRemove = existingTemplates.filter(
      (t) => !metaKeys.has(`${t.name}_${t.language}`)
    );

    let removed = 0;
    if (toRemove.length > 0) {
      const result = await prisma.template.deleteMany({
        where: { id: { in: toRemove.map((t) => t.id) } },
      });
      removed = result.count;
    }

    console.log(`✅ Sync complete:`);
    console.log(`   Created: ${created}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Removed: ${removed}`);
    console.log(`   Skipped: ${skipped}`);

    return {
      created,
      updated,
      removed,
      skipped,
      total: metaTemplates.length,
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
        select: { organizationId: true, id: true },
      });

      if (!account) {
        console.error('Account not found for background sync');
        return;
      }

      let synced = 0;

      for (const template of templates) {
        try {
          const status = this.mapTemplateStatus(template.status);

          if (status === 'DRAFT' || status === 'REJECTED') continue;

          const existing = await prisma.template.findFirst({
            where: {
              whatsappAccountId: accountId,
              name: template.name,
              language: template.language,
            } as any,
          });

          const templateData = {
            organizationId: account.organizationId,
            whatsappAccountId: accountId,
            wabaId: wabaId,
            metaTemplateId: template.id,
            name: template.name,
            language: template.language,
            category: this.mapCategory(template.category),
            status: status as TemplateStatus,
            bodyText: this.extractBodyText(template.components),
            headerType: this.extractHeaderType(template.components),
            headerContent: this.extractHeaderContent(template.components),
            footerText: this.extractFooterText(template.components),
            buttons: this.extractButtons(template.components),
            variables: this.extractVariables(template.components),
            qualityScore: template.quality_score?.score || null,
          };

          if (existing) {
            await prisma.template.update({
              where: { id: existing.id },
              data: templateData,
            });
          } else {
            await prisma.template.create({ data: templateData });
          }

          synced++;
        } catch (err: any) {
          console.error(`Background sync error for ${template.name}:`, err.message);
        }
      }

      console.log(`✅ Background sync: ${synced}/${templates.length} templates`);
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

  private extractVariables(components: any[]): any {
    if (!Array.isArray(components)) return [];

    const variables: any[] = [];

    for (const component of components) {
      if (component.type === 'BODY' && component.text) {
        const matches = component.text.match(/\{\{(\d+)\}\}/g);
        if (matches) {
          matches.forEach((match: string, index: number) => {
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
}

export const metaService = new MetaService();
export default metaService;