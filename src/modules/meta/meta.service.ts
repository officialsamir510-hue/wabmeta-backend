// src/modules/meta/meta.service.ts

import { MetaConnection, PrismaClient } from '@prisma/client';
import { MetaGraphAPI } from './meta.api';
import { EncryptionUtil } from '../../utils/encryption';

const prisma = new PrismaClient();

export class MetaService {
  /**
   * Generate OAuth authorization URL
   */
  static getAuthorizationUrl(organizationId: string, userId: string): string {
    const configId = process.env.META_CONFIG_ID;
    const appId = process.env.META_APP_ID;
    const redirectUri = process.env.META_REDIRECT_URI;

    if (!configId || !appId || !redirectUri) {
      console.error('Missing Meta configuration:', {
        configId: !!configId,
        appId: !!appId,
        redirectUri: !!redirectUri
      });
      throw new Error('WhatsApp Business integration not properly configured');
    }

    const state = Buffer.from(JSON.stringify({
      organizationId,
      userId,
      timestamp: Date.now()
    })).toString('base64');

    const params = new URLSearchParams({
      client_id: appId,
      config_id: configId,
      response_type: 'code',
      override_default_response_type: 'true',
      state: state,
      redirect_uri: redirectUri,
    });

    const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;

    console.log('Generated auth URL for org:', organizationId);

    return authUrl;
  }

  /**
   * Handle OAuth callback and store connection
   */
  static async handleOAuthCallback(code: string, state: string) {
    let organizationId: string | undefined;
    let userId: string | undefined;

    try {
      // Decode state
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      organizationId = stateData.organizationId;
      userId = stateData.userId;

      console.log('OAuth callback for org:', organizationId);

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

      console.log('Token exchanged successfully');

      // Get long-lived token (60 days) - use access_token
      const longLivedToken = await api.getLongLivedToken(tokenResponse.access_token);

      // Get accessible WABAs for this user - use access_token
      const wabas = await api.getAccessibleWABAs(longLivedToken.access_token);

      if (!wabas || wabas.length === 0) {
        throw new Error('No WhatsApp Business Account found. Please create one in Meta Business Suite first.');
      }

      console.log(`Found ${wabas.length} WABAs`);

      // If multiple WABAs, use first one
      const selectedWaba = wabas[0];

      // Get phone numbers for selected WABA - use access_token
      const phoneNumbers = await api.getPhoneNumbers(selectedWaba.id, longLivedToken.access_token);

      if (!phoneNumbers || phoneNumbers.length === 0) {
        throw new Error('No phone numbers found. Please add a phone number to your WhatsApp Business Account.');
      }

      console.log(`Found ${phoneNumbers.length} phone numbers`);

      // Encrypt access token before storing - use access_token
      const encryptedToken = EncryptionUtil.encrypt(longLivedToken.access_token);

      // Calculate token expiry (60 days for long-lived token)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 60);

      // Store or update MetaConnection for this organization
      const metaConnection = await prisma.metaConnection.upsert({
        where: { organizationId: organizationId! },
        create: {
          organizationId: organizationId!,
          accessToken: encryptedToken,
          accessTokenExpiresAt: expiresAt,
          wabaId: selectedWaba.id,
          wabaName: selectedWaba.name,
          status: 'CONNECTED',
          lastSyncedAt: new Date(),
          messagingLimit: phoneNumbers[0]?.messaging_limit_tier || 'TIER_1'
        },
        update: {
          accessToken: encryptedToken,
          accessTokenExpiresAt: expiresAt,
          wabaId: selectedWaba.id,
          wabaName: selectedWaba.name,
          status: 'CONNECTED',
          lastSyncedAt: new Date(),
          errorMessage: null,
          messagingLimit: phoneNumbers[0]?.messaging_limit_tier || 'TIER_1'
        }
      });

      // Store phone numbers for this organization
      for (const phone of phoneNumbers) {
        await prisma.phoneNumber.upsert({
          where: { phoneNumberId: phone.id },
          create: {
            metaConnectionId: metaConnection.id,
            phoneNumberId: phone.id,
            phoneNumber: phone.display_phone_number,
            displayName: phone.display_phone_number,
            verifiedName: phone.verified_name || '',
            qualityRating: phone.quality_rating || 'UNKNOWN',
            isActive: true,
            isPrimary: phoneNumbers.indexOf(phone) === 0
          },
          update: {
            phoneNumber: phone.display_phone_number,
            verifiedName: phone.verified_name || '',
            qualityRating: phone.quality_rating || 'UNKNOWN',
            isActive: true
          }
        });
      }

      // Log activity
      await prisma.activityLog.create({
        data: {
          organizationId,
          userId,
          action: 'META_CONNECTED',
          entity: 'MetaConnection',
          entityId: metaConnection.id,
          metadata: {
            wabaName: selectedWaba.name,
            wabaId: selectedWaba.id,
            phoneNumbers: phoneNumbers.map((p: any) => p.display_phone_number),
            messagingTier: phoneNumbers[0]?.messaging_limit_tier
          }
        }
      });

      console.log('✅ Meta connection established for org:', organization.name);

      return {
        success: true,
        connection: {
          id: metaConnection.id,
          wabaName: selectedWaba.name,
          status: 'CONNECTED'
        },
        phoneNumbers: phoneNumbers.map((p: any) => ({
          id: p.id,
          number: p.display_phone_number,
          verified: p.verified_name,
          quality: p.quality_rating
        }))
      };

    } catch (error: any) {
      console.error('OAuth callback error:', error);

      // Log failed attempt if we have organizationId and userId
      if (organizationId && userId) {
        try {
          await prisma.activityLog.create({
            data: {
              organizationId,
              userId,
              action: 'META_CONNECTION_FAILED',
              entity: 'MetaConnection',
              metadata: {
                error: error.message
              }
            }
          });
        } catch (logError) {
          console.error('Failed to log activity:', logError);
        }
      }

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

  /**
   * Create a new MetaConnection
   */
  static async createMetaConnection(organizationId: string, accessToken: string, wabaId: string, wabaName: string, messagingLimit: string): Promise<MetaConnection> {
    if (!organizationId) {
      throw new Error("organizationId is required");
    }

    const metaConnection = await prisma.metaConnection.create({
      data: {
        organizationId,
        accessToken,
        accessTokenExpiresAt: new Date(),
        wabaId,
        wabaName,
        status: "CONNECTED",
        lastSyncedAt: new Date(),
        messagingLimit,
      },
    });

    return metaConnection;
  }
}