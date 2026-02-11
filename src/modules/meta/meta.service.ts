// src/modules/meta/meta.service.ts

import { PrismaClient, WhatsAppAccountStatus, ConnectionStatus } from '@prisma/client';
import { metaApi } from './meta.api';
import { config } from '../../config';
import { encrypt, decrypt } from '../../utils/encryption';
import { v4 as uuidv4 } from 'uuid';
import {
  ConnectionProgress,
  SharedWABAInfo,
  PhoneNumberInfo,
} from './meta.types';

const prisma = new PrismaClient();

class MetaService {
  /**
   * Generate OAuth URL for Meta login
   */
  getOAuthUrl(state: string): string {
    const baseUrl = 'https://www.facebook.com/v18.0/dialog/oauth';
    const params = new URLSearchParams({
      client_id: config.meta.appId,
      redirect_uri: config.meta.redirectUri,
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
      appId: config.meta.appId,
      configId: config.meta.configId,
      version: config.meta.graphApiVersion,
      features: ['WHATSAPP_EMBEDDED_SIGNUP'],
    };
  }

  /**
   * Complete Meta connection flow
   */
  async completeConnection(
    code: string,
    organizationId: string,
    userId: string,
    onProgress?: (progress: ConnectionProgress) => void
  ): Promise<{ success: boolean; account?: any; error?: string }> {
    try {
      // Step 1: Exchange code for access token
      onProgress?.({
        step: 'TOKEN_EXCHANGE',
        status: 'in_progress',
        message: 'Exchanging authorization code for access token...',
      });

      const tokenResponse = await metaApi.exchangeCodeForToken(code);
      let accessToken = tokenResponse.accessToken;

      // Get long-lived token
      try {
        const longLivedTokenResponse = await metaApi.getLongLivedToken(accessToken);
        accessToken = longLivedTokenResponse.accessToken;
      } catch (error) {
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

      const debugInfo = await metaApi.debugToken(accessToken);
      
      // Get WABAs from granular scopes
      let wabaId: string | null = null;
      let businessId: string | null = null;
      
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
        const wabas = await metaApi.getSharedWABAs(accessToken);
        if (wabas.length > 0) {
          wabaId = wabas[0].id;
          businessId = wabas[0].owner_business_info?.id || businessId;
        }
      }

      if (!wabaId) {
        throw new Error('No WhatsApp Business Account found. Please complete the WhatsApp signup process.');
      }

      // Get WABA details
      const wabaDetails = await metaApi.getWABADetails(wabaId, accessToken);

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

      const phoneNumbers = await metaApi.getPhoneNumbers(wabaId, accessToken);
      
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
        await metaApi.subscribeToWebhooks(wabaId, accessToken);
      } catch (error) {
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
              accessToken: encrypt(accessToken),
              tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
              verifiedName: primaryPhone.verifiedName,
              qualityRating: primaryPhone.qualityRating,
              status: WhatsAppAccountStatus.ACTIVE,
              connectionStatus: ConnectionStatus.CONNECTED,
              lastConnectedAt: new Date(),
              lastSyncedAt: new Date(),
            },
          });

          onProgress?.({
            step: 'COMPLETED',
            status: 'completed',
            message: 'Account reconnected successfully!',
          });

          return { success: true, account: this.sanitizeAccount(updatedAccount) };
        } else {
          throw new Error('This WhatsApp number is already connected to another organization.');
        }
      }

      // Generate webhook verify token
      const webhookVerifyToken = uuidv4();

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
          businessId: businessId || wabaDetails.owner_business_info?.id,
          phoneNumber: primaryPhone.displayPhoneNumber.replace(/\D/g, ''),
          displayPhoneNumber: primaryPhone.displayPhoneNumber,
          verifiedName: primaryPhone.verifiedName,
          qualityRating: primaryPhone.qualityRating,
          accessToken: encrypt(accessToken),
          tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
          webhookVerifyToken,
          webhookConfigured: true,
          status: WhatsAppAccountStatus.ACTIVE,
          connectionStatus: ConnectionStatus.CONNECTED,
          lastConnectedAt: new Date(),
          lastSyncedAt: new Date(),
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
    } catch (error: any) {
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
  async getAccounts(organizationId: string) {
    const accounts = await prisma.whatsAppAccount.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });

    return accounts.map((account) => this.sanitizeAccount(account));
  }

  /**
   * Get single account
   */
  async getAccount(accountId: string, organizationId: string) {
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
  async getAccountWithToken(accountId: string): Promise<{
    account: any;
    accessToken: string;
  } | null> {
    const account = await prisma.whatsAppAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return null;
    }

    return {
      account,
      accessToken: decrypt(account.accessToken),
    };
  }

  /**
   * Disconnect account
   */
  async disconnectAccount(accountId: string, organizationId: string) {
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
        status: WhatsAppAccountStatus.DISCONNECTED,
        connectionStatus: ConnectionStatus.DISCONNECTED,
        accessToken: '', // Clear token
      },
    });

    // If this was default, set another as default
    if (account.isDefault) {
      const anotherAccount = await prisma.whatsAppAccount.findFirst({
        where: {
          organizationId,
          id: { not: accountId },
          status: WhatsAppAccountStatus.ACTIVE,
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
  async setDefaultAccount(accountId: string, organizationId: string) {
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
  async refreshAccountHealth(accountId: string, organizationId: string) {
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
      const debugInfo = await metaApi.debugToken(accessToken);
      
      if (!debugInfo.data.is_valid) {
        await prisma.whatsAppAccount.update({
          where: { id: accountId },
          data: {
            status: WhatsAppAccountStatus.ERROR,
            connectionStatus: ConnectionStatus.ERROR,
          },
        });
        
        return { healthy: false, reason: 'Token expired' };
      }

      // Get phone number health
      const phoneNumbers = await metaApi.getPhoneNumbers(account.wabaId, accessToken);
      const phone = phoneNumbers.find((p) => p.id === account.phoneNumberId);

      if (phone) {
        await prisma.whatsAppAccount.update({
          where: { id: accountId },
          data: {
            qualityRating: phone.qualityRating,
            status: WhatsAppAccountStatus.ACTIVE,
            connectionStatus: ConnectionStatus.CONNECTED,
            lastSyncedAt: new Date(),
          },
        });

        return {
          healthy: true,
          qualityRating: phone.qualityRating,
          verifiedName: phone.verifiedName,
        };
      }

      return { healthy: false, reason: 'Phone number not found' };
    } catch (error: any) {
      await prisma.whatsAppAccount.update({
        where: { id: accountId },
        data: {
          status: WhatsAppAccountStatus.ERROR,
          connectionStatus: ConnectionStatus.ERROR,
        },
      });

      return { healthy: false, reason: error.message };
    }
  }

  /**
   * Sync templates from Meta
   */
  async syncTemplates(accountId: string, organizationId: string) {
    const result = await this.getAccountWithToken(accountId);
    
    if (!result) {
      throw new Error('Account not found');
    }

    const { account, accessToken } = result;

    if (account.organizationId !== organizationId) {
      throw new Error('Unauthorized');
    }

    const templates = await metaApi.getTemplates(account.wabaId, accessToken);

    // Upsert templates
    for (const template of templates) {
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
          whatsappAccountId: accountId,
          metaTemplateId: template.id,
          name: template.name,
          language: template.language,
          category: this.mapCategory(template.category),
          status: this.mapTemplateStatus(template.status),
          bodyText: this.extractBodyText(template.components),
          headerType: this.extractHeaderType(template.components),
          headerContent: this.extractHeaderContent(template.components),
          footerText: this.extractFooterText(template.components),
          buttons: this.extractButtons(template.components),
          lastSyncedAt: new Date(),
        },
        update: {
          status: this.mapTemplateStatus(template.status),
          lastSyncedAt: new Date(),
        },
      });
    }

    await prisma.whatsAppAccount.update({
      where: { id: accountId },
      data: { lastSyncedAt: new Date() },
    });

    return { synced: templates.length };
  }

  /**
   * Background template sync
   */
  private async syncTemplatesBackground(
    accountId: string,
    wabaId: string,
    accessToken: string
  ) {
    try {
      const templates = await metaApi.getTemplates(wabaId, accessToken);
      console.log(`Synced ${templates.length} templates for account ${accountId}`);
    } catch (error) {
      console.error('Background template sync failed:', error);
    }
  }

  /**
   * Remove sensitive data from account
   */
  private sanitizeAccount(account: any) {
    const { accessToken, systemUserAccessToken, webhookSecret, ...safe } = account;
    return {
      ...safe,
      hasAccessToken: !!accessToken,
    };
  }

  // Helper methods for template parsing
  private mapCategory(category: string): 'MARKETING' | 'UTILITY' | 'AUTHENTICATION' {
    const map: Record<string, 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'> = {
      MARKETING: 'MARKETING',
      UTILITY: 'UTILITY',
      AUTHENTICATION: 'AUTHENTICATION',
    };
    return map[category] || 'UTILITY';
  }

  private mapTemplateStatus(status: string): 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' {
    const map: Record<string, 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED'> = {
      APPROVED: 'APPROVED',
      PENDING: 'PENDING',
      REJECTED: 'REJECTED',
    };
    return map[status] || 'PENDING';
  }

  private extractBodyText(components: any[]): string {
    const body = components?.find((c: any) => c.type === 'BODY');
    return body?.text || '';
  }

  private extractHeaderType(components: any[]): 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | null {
    const header = components?.find((c: any) => c.type === 'HEADER');
    if (!header) return null;
    return header.format as any;
  }

  private extractHeaderContent(components: any[]): string | null {
    const header = components?.find((c: any) => c.type === 'HEADER');
    return header?.text || null;
  }

  private extractFooterText(components: any[]): string | null {
    const footer = components?.find((c: any) => c.type === 'FOOTER');
    return footer?.text || null;
  }

  private extractButtons(components: any[]): any {
    const buttons = components?.find((c: any) => c.type === 'BUTTONS');
    return buttons?.buttons || null;
  }
}

export const metaService = new MetaService();
export default metaService;