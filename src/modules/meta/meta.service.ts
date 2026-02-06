// src/modules/meta/meta.service.ts

import { PrismaClient } from '@prisma/client';
import { MetaGraphAPI } from './meta.api';
import { EncryptionUtil } from '../../utils/encryption';

const prisma = new PrismaClient();

export class MetaService {
  /**
   * Generate OAuth authorization URL
   */
  static getAuthorizationUrl(organizationId: string, userId: string): string {
    const configId = process.env.META_CONFIG_ID;
    
    if (!configId) {
      throw new Error('META_CONFIG_ID not configured');
    }

    const state = Buffer.from(JSON.stringify({ 
      organizationId, 
      userId,
      timestamp: Date.now() 
    })).toString('base64');

    const params = new URLSearchParams({
      client_id: process.env.META_APP_ID!,
      config_id: configId,
      response_type: 'code',
      override_default_response_type: 'true',
      state: state,
      redirect_uri: process.env.META_REDIRECT_URI!,
    });

    return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
  }

  /**
   * Handle OAuth callback and store connection
   */
  static async handleOAuthCallback(code: string, state: string) {
    try {
      // Decode state
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      const { organizationId, userId } = stateData;

      // Verify organization exists
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        include: { metaConnection: true }
      });

      if (!organization) {
        throw new Error('Organization not found');
      }

      // Exchange code for token
      const api = new MetaGraphAPI();
      const tokenResponse = await api.exchangeCodeForToken(code);

      // Get long-lived token (60 days)
      const longLivedToken = await api.getLongLivedToken(tokenResponse.access_token);

      // Initialize API with new token
      const authenticatedAPI = new MetaGraphAPI(longLivedToken.access_token);

      // Get user's WhatsApp Business Accounts
      const wabas = await authenticatedAPI.getWhatsAppBusinessAccounts(userId);

      if (!wabas || wabas.length === 0) {
        throw new Error('No WhatsApp Business Account found. Please create one first.');
      }

      // Use first WABA (can be extended for multi-WABA selection)
      const waba = wabas[0];

      // Get phone numbers for this WABA
      const phoneNumbers = await authenticatedAPI.getPhoneNumbers(waba.id);

      if (!phoneNumbers || phoneNumbers.length === 0) {
        throw new Error('No phone numbers found for this WhatsApp Business Account');
      }

      // Encrypt access token before storing
      const encryptedToken = EncryptionUtil.encrypt(longLivedToken.access_token);

      // Calculate token expiry (60 days for long-lived token)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 60);

      // Store or update MetaConnection
      const metaConnection = await prisma.metaConnection.upsert({
        where: { organizationId },
        create: {
          organizationId,
          accessToken: encryptedToken,
          accessTokenExpiresAt: expiresAt,
          wabaId: waba.id,
          wabaName: waba.name,
          status: 'CONNECTED',
          lastSyncedAt: new Date()
        },
        update: {
          accessToken: encryptedToken,
          accessTokenExpiresAt: expiresAt,
          wabaId: waba.id,
          wabaName: waba.name,
          status: 'CONNECTED',
          lastSyncedAt: new Date(),
          errorMessage: null
        }
      });

      // Store phone numbers
      for (const phone of phoneNumbers) {
        await prisma.phoneNumber.upsert({
          where: { phoneNumberId: phone.id },
          create: {
            metaConnectionId: metaConnection.id,
            phoneNumberId: phone.id,
            phoneNumber: phone.display_phone_number,
            displayName: phone.display_phone_number,
            verifiedName: phone.verified_name,
            qualityRating: phone.quality_rating,
            isActive: true,
            isPrimary: phoneNumbers.indexOf(phone) === 0
          },
          update: {
            phoneNumber: phone.display_phone_number,
            verifiedName: phone.verified_name,
            qualityRating: phone.quality_rating,
            isActive: true
          }
        });
      }

      // Log activity (✅ FIXED - no description field)
      await prisma.activityLog.create({
        data: {
          organizationId,
          userId,
          action: 'META_CONNECTED',
          entity: 'MetaConnection',
          entityId: metaConnection.id,
          metadata: {
            wabaName: waba.name,
            wabaId: waba.id,
            phoneNumbers: phoneNumbers.map(p => p.display_phone_number)
          }
        }
      });

      return {
        success: true,
        connection: metaConnection,
        phoneNumbers: phoneNumbers.map(p => ({
          id: p.id,
          number: p.display_phone_number,
          verified: p.verified_name
        }))
      };

    } catch (error: any) {
      console.error('OAuth callback error:', error);
      throw new Error(error.message || 'Failed to connect WhatsApp account');
    }
  }

  /**
   * Get connection status for organization
   */
  static async getConnectionStatus(organizationId: string) {
    const connection = await prisma.metaConnection.findUnique({
      where: { organizationId },
      include: {
        phoneNumbers: {
          where: { isActive: true }
        }
      }
    });

    if (!connection) {
      return {
        connected: false,
        status: 'NOT_CONNECTED'
      };
    }

    // Check if token expired
    const isExpired = connection.accessTokenExpiresAt && 
                     new Date() > connection.accessTokenExpiresAt;

    if (isExpired) {
      await prisma.metaConnection.update({
        where: { id: connection.id },
        data: { status: 'TOKEN_EXPIRED' }
      });

      return {
        connected: false,
        status: 'TOKEN_EXPIRED',
        expiresAt: connection.accessTokenExpiresAt
      };
    }

    return {
      connected: true,
      status: connection.status,
      waba: {
        id: connection.wabaId,
        name: connection.wabaName
      },
      phoneNumbers: connection.phoneNumbers.map((p: any) => ({
        id: p.phoneNumberId,
        number: p.phoneNumber,
        verifiedName: p.verifiedName,
        quality: p.qualityRating,
        isPrimary: p.isPrimary
      })),
      lastSynced: connection.lastSyncedAt
    };
  }

  /**
   * Disconnect WhatsApp account
   */
  static async disconnect(organizationId: string) {
    try {
      const connection = await prisma.metaConnection.findUnique({
        where: { organizationId }
      });

      if (!connection) {
        throw new Error('No connection found');
      }

      // Update status to disconnected
      await prisma.metaConnection.update({
        where: { organizationId },
        data: {
          status: 'DISCONNECTED',
          errorMessage: 'Manually disconnected by user'
        }
      });

      // Deactivate phone numbers
      await prisma.phoneNumber.updateMany({
        where: { metaConnectionId: connection.id },
        data: { isActive: false }
      });

      return { success: true };
    } catch (error: any) {
      throw new Error(error.message || 'Failed to disconnect');
    }
  }

  /**
   * Get decrypted access token for API calls
   */
  static async getAccessToken(organizationId: string): Promise<string> {
    const connection = await prisma.metaConnection.findUnique({
      where: { organizationId }
    });

    if (!connection) {
      throw new Error('WhatsApp not connected');
    }

    if (connection.status !== 'CONNECTED') {
      throw new Error(`Connection status: ${connection.status}`);
    }

    // Check expiry
    if (connection.accessTokenExpiresAt && new Date() > connection.accessTokenExpiresAt) {
      throw new Error('Access token expired. Please reconnect.');
    }

    return EncryptionUtil.decrypt(connection.accessToken);
  }
}