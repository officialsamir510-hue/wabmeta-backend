// src/modules/meta/meta.service.ts

import prisma from '../../config/database';
import { config } from '../../config';
import { AppError } from '../../middleware/errorHandler';
import { MetaGraphAPI } from './meta.api';
import axios from 'axios';

const GRAPH_API_VERSION = 'v21.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// Helper function to format connection response
function formatConnectionResponse(connection: any) {
  return {
    id: connection.id,
    organizationId: connection.organizationId,
    wabaId: connection.wabaId,
    wabaName: connection.wabaName,
    status: connection.status,
    phoneNumbers: (connection.phoneNumbers || []).map((p: any) => ({
      id: p.id,
      phoneNumberId: p.phoneNumberId,
      phoneNumber: p.phoneNumber,
      displayName: p.displayName,
      isPrimary: p.isPrimary,
      isActive: p.isActive,
    })),
    whatsappAccounts: (connection.whatsappAccounts || []).map((a: any) => ({
      id: a.id,
      phoneNumber: a.phoneNumber,
      displayName: a.displayName,
      status: a.status,
      isDefault: a.isDefault,
    })),
    lastSyncedAt: connection.lastSyncedAt,
    webhookVerified: connection.webhookVerified,
  };
}

export class MetaService {
  /**
   * ✅ CONNECT VIA EMBEDDED SIGNUP - COMPLETE FIX
   */
  static async connectEmbeddedSignup(
    organizationId: string,
    code: string,
    state?: string
  ) {
    try {
      console.log('🔄 Starting Embedded Signup connection...');
      console.log('   Organization:', organizationId);

      if (!organizationId) {
        throw new AppError('Organization ID is required', 400);
      }

      // ✅ Check for recent duplicate connection attempts
      const existingConnection = await prisma.metaConnection.findUnique({
        where: { organizationId },
        include: { 
          phoneNumbers: { 
            where: { isActive: true },
            orderBy: { isPrimary: 'desc' }
          }
        }
      });

      if (existingConnection?.status === 'CONNECTED' && 
          existingConnection.phoneNumbers.length > 0) {
        
        const lastSync = existingConnection.lastSyncedAt?.getTime() || 0;
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        
        if (lastSync > fiveMinutesAgo) {
          console.log('✅ Already connected recently, returning existing');
          
          const whatsappAccounts = await prisma.whatsAppAccount.findMany({
            where: { organizationId, status: 'CONNECTED' }
          });
          
          return formatConnectionResponse({
            ...existingConnection,
            whatsappAccounts
          });
        }
      }

      // 1. Exchange code for access token
      console.log('🔄 Exchanging code for access token...');
      const tokenResponse = await this.exchangeCodeForToken(code);
      
      if (!tokenResponse.access_token) {
        throw new AppError('Failed to get access token from Meta', 400);
      }

      console.log('✅ Got access token');

      // 2. Get WhatsApp Business Accounts
      const wabaData = await this.getWhatsAppBusinessAccounts(tokenResponse.access_token);
      
      if (!wabaData || wabaData.length === 0) {
        throw new AppError('No WhatsApp Business Account found. Please create one in Meta Business Manager.', 400);
      }

      console.log('✅ Found WABAs:', wabaData.length);

      // 3. Get phone numbers
      const allPhoneNumbers: any[] = [];
      
      for (const waba of wabaData) {
        const phoneNumbers = await this.getPhoneNumbers(waba.id, tokenResponse.access_token);
        
        for (const phone of phoneNumbers) {
          allPhoneNumbers.push({
            ...phone,
            wabaId: waba.id,
            wabaName: waba.name,
          });
        }
      }

      if (allPhoneNumbers.length === 0) {
        throw new AppError('No phone numbers found. Please add a phone number to your WhatsApp Business Account.', 400);
      }

      console.log('✅ Found phone numbers:', allPhoneNumbers.length);

      // 4. Save to database with transaction
      const result = await prisma.$transaction(async (tx) => {
        // ✅ Upsert MetaConnection
        const metaConnection = await tx.metaConnection.upsert({
          where: { organizationId },
          update: {
            accessToken: tokenResponse.access_token,
            accessTokenExpiresAt: tokenResponse.expires_in 
              ? new Date(Date.now() + tokenResponse.expires_in * 1000)
              : null,
            wabaId: wabaData[0].id,
            wabaName: wabaData[0].name || null,
            businessId: wabaData[0].business?.id || null,
            status: 'CONNECTED',
            lastSyncedAt: new Date(),
            errorMessage: null,
            webhookVerified: true,
          },
          create: {
            organizationId,
            accessToken: tokenResponse.access_token,
            accessTokenExpiresAt: tokenResponse.expires_in 
              ? new Date(Date.now() + tokenResponse.expires_in * 1000)
              : null,
            wabaId: wabaData[0].id,
            wabaName: wabaData[0].name || null,
            businessId: wabaData[0].business?.id || null,
            status: 'CONNECTED',
            lastSyncedAt: new Date(),
            webhookVerified: true,
          },
        });

        console.log('✅ MetaConnection saved');

        // ✅ Upsert PhoneNumbers
        const savedPhoneNumbers = [];
        for (let i = 0; i < allPhoneNumbers.length; i++) {
          const phone = allPhoneNumbers[i];
          
          const savedPhone = await tx.phoneNumber.upsert({
            where: { phoneNumberId: phone.id },
            update: {
              metaConnectionId: metaConnection.id,
              phoneNumber: phone.display_phone_number || phone.verified_name || '',
              displayName: phone.verified_name || null,
              qualityRating: phone.quality_rating || null,
              verifiedName: phone.verified_name || null,
              isActive: true,
              isPrimary: i === 0,
            },
            create: {
              metaConnectionId: metaConnection.id,
              phoneNumberId: phone.id,
              phoneNumber: phone.display_phone_number || phone.verified_name || '',
              displayName: phone.verified_name || null,
              qualityRating: phone.quality_rating || null,
              verifiedName: phone.verified_name || null,
              isActive: true,
              isPrimary: i === 0,
            },
          });
          
          savedPhoneNumbers.push(savedPhone);
        }

        console.log('✅ Phone numbers saved:', savedPhoneNumbers.length);

        // ✅ Upsert WhatsAppAccounts for backward compatibility
        const savedAccounts = [];
        for (let i = 0; i < allPhoneNumbers.length; i++) {
          const phone = allPhoneNumbers[i];
          const savedPhone = savedPhoneNumbers[i];
          
          const account = await tx.whatsAppAccount.upsert({
            where: { phoneNumberId: phone.id },
            update: {
              organizationId, // ✅ CRITICAL: Always set organizationId
              wabaId: phone.wabaId,
              phoneNumber: savedPhone.phoneNumber,
              displayName: savedPhone.displayName || 'WhatsApp Business',
              accessToken: tokenResponse.access_token,
              tokenExpiresAt: tokenResponse.expires_in 
                ? new Date(Date.now() + tokenResponse.expires_in * 1000)
                : null,
              status: 'CONNECTED',
              isDefault: i === 0,
            },
            create: {
              organizationId, // ✅ CRITICAL: Set organizationId
              phoneNumberId: phone.id,
              wabaId: phone.wabaId,
              phoneNumber: savedPhone.phoneNumber,
              displayName: savedPhone.displayName || 'WhatsApp Business',
              accessToken: tokenResponse.access_token,
              tokenExpiresAt: tokenResponse.expires_in 
                ? new Date(Date.now() + tokenResponse.expires_in * 1000)
                : null,
              status: 'CONNECTED',
              isDefault: i === 0,
            },
          });
          
          savedAccounts.push(account);
        }

        console.log('✅ WhatsApp accounts synced:', savedAccounts.length);

        // Create activity log
        await tx.activityLog.create({
          data: {
            organizationId,
            action: 'META_CONNECTED',
            entity: 'MetaConnection',
            entityId: metaConnection.id,
            metadata: {
              wabaId: metaConnection.wabaId,
              phoneCount: savedPhoneNumbers.length,
            },
          },
        });

        return { 
          metaConnection, 
          phoneNumbers: savedPhoneNumbers,
          whatsappAccounts: savedAccounts 
        };
      });

      console.log('✅ Meta connection completed successfully!');

      return formatConnectionResponse({
        ...result.metaConnection,
        phoneNumbers: result.phoneNumbers,
        whatsappAccounts: result.whatsappAccounts,
      });

    } catch (error: any) {
      console.error('❌ Meta connection error:', error);

      // Handle duplicate key errors
      if (error.code === 'P2002' || error.message?.includes('Unique constraint')) {
        console.log('⚠️ Duplicate error, fetching existing connection...');
        
        const existing = await prisma.metaConnection.findUnique({
          where: { organizationId },
          include: { 
            phoneNumbers: { where: { isActive: true } }
          }
        });

        if (existing?.status === 'CONNECTED') {
          const whatsappAccounts = await prisma.whatsAppAccount.findMany({
            where: { organizationId, status: 'CONNECTED' }
          });
          
          return formatConnectionResponse({
            ...existing,
            whatsappAccounts
          });
        }
      }

      // Handle "code already used" gracefully
      if (error.message?.includes('authorization code has been used') ||
          error.message?.includes('Code has expired')) {
        
        const existingConnection = await prisma.metaConnection.findUnique({
          where: { organizationId },
          include: { phoneNumbers: { where: { isActive: true } } }
        });

        if (existingConnection?.status === 'CONNECTED') {
          const whatsappAccounts = await prisma.whatsAppAccount.findMany({
            where: { organizationId, status: 'CONNECTED' }
          });
          
          return formatConnectionResponse({
            ...existingConnection,
            whatsappAccounts
          });
        }
        
        throw new AppError(
          'This authorization code has already been used. Please try connecting again.',
          400
        );
      }

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        error.message || 'Failed to connect Meta account',
        500
      );
    }
  }

  /**
   * ✅ EXCHANGE CODE FOR TOKEN
   */
  private static async exchangeCodeForToken(code: string) {
    try {
      const response = await axios.get(`${GRAPH_API_BASE}/oauth/access_token`, {
        params: {
          client_id: config.meta.appId,
          client_secret: config.meta.appSecret,
          code,
          redirect_uri: config.meta.redirectUri,
        },
      });

      return response.data;
    } catch (error: any) {
      console.error('❌ Token exchange error:', error.response?.data);
      throw new AppError(
        error.response?.data?.error?.message || 'Failed to exchange code for token',
        400
      );
    }
  }

  /**
   * ✅ GET WHATSAPP BUSINESS ACCOUNTS
   */
  private static async getWhatsAppBusinessAccounts(accessToken: string) {
    try {
      // Get debug token info
      const debugResponse = await axios.get(`${GRAPH_API_BASE}/debug_token`, {
        params: {
          input_token: accessToken,
          access_token: `${config.meta.appId}|${config.meta.appSecret}`,
        },
      });

      const granularScopes = debugResponse.data?.data?.granular_scopes || [];
      const wabaScope = granularScopes.find(
        (s: any) => s.scope === 'whatsapp_business_management'
      );

      if (wabaScope?.target_ids?.length > 0) {
        const wabaPromises = wabaScope.target_ids.map(async (wabaId: string) => {
          const response = await axios.get(`${GRAPH_API_BASE}/${wabaId}`, {
            params: {
              access_token: accessToken,
              fields: 'id,name,currency,timezone_id,business',
            },
          });
          return response.data;
        });

        return await Promise.all(wabaPromises);
      }

      // Fallback: Try shared WABAs
      const sharedResponse = await axios.get(`${GRAPH_API_BASE}/me/businesses`, {
        params: {
          access_token: accessToken,
          fields: 'id,name,owned_whatsapp_business_accounts{id,name}',
        },
      });

      const businesses = sharedResponse.data?.data || [];
      const allWabas: any[] = [];

      for (const business of businesses) {
        const wabas = business.owned_whatsapp_business_accounts?.data || [];
        allWabas.push(...wabas);
      }

      return allWabas;
    } catch (error: any) {
      console.error('❌ Get WABAs error:', error.response?.data);
      return [];
    }
  }

  /**
   * ✅ GET PHONE NUMBERS
   */
  private static async getPhoneNumbers(wabaId: string, accessToken: string) {
    try {
      const response = await axios.get(`${GRAPH_API_BASE}/${wabaId}/phone_numbers`, {
        params: {
          access_token: accessToken,
          fields: 'id,display_phone_number,verified_name,quality_rating,status',
        },
      });

      return response.data?.data || [];
    } catch (error: any) {
      console.error('❌ Get phone numbers error:', error.response?.data);
      return [];
    }
  }

  /**
   * ✅ GET CONNECTION STATUS - CHECKS BOTH SYSTEMS
   */
  static async getConnectionStatus(organizationId: string) {
    try {
      console.log('🔍 Checking connection status for org:', organizationId);

      // Check MetaConnection
      const metaConnection = await prisma.metaConnection.findUnique({
        where: { organizationId },
        include: {
          phoneNumbers: {
            where: { isActive: true },
            orderBy: { isPrimary: 'desc' }
          }
        }
      });

      // Check WhatsAppAccounts
      const whatsappAccounts = await prisma.whatsAppAccount.findMany({
        where: { 
          organizationId,
          status: 'CONNECTED'
        },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }]
      });

      console.log('   MetaConnection:', metaConnection ? 'Found' : 'Not found');
      console.log('   WhatsApp Accounts:', whatsappAccounts.length);

      // If we have connected WhatsApp accounts, we're connected
      if (whatsappAccounts.length > 0) {
        return {
          isConnected: true,
          status: 'CONNECTED',
          message: 'WhatsApp connected',
          connection: metaConnection,
          whatsappAccounts: whatsappAccounts.map(acc => ({
            id: acc.id,
            phoneNumber: acc.phoneNumber,
            displayName: acc.displayName,
            status: acc.status,
            isDefault: acc.isDefault,
          })),
          phoneNumbers: whatsappAccounts.map(acc => ({
            phoneNumber: acc.phoneNumber,
            displayName: acc.displayName,
          })),
          phoneCount: whatsappAccounts.length,
          primaryAccount: whatsappAccounts[0],
        };
      }

      // Check if token expired
      if (metaConnection) {
        if (metaConnection.accessTokenExpiresAt && 
            metaConnection.accessTokenExpiresAt < new Date()) {
          return {
            isConnected: false,
            status: 'TOKEN_EXPIRED',
            message: 'Access token expired. Please reconnect.',
            connection: metaConnection,
            whatsappAccounts: [],
            phoneNumbers: [],
          };
        }

        return {
          isConnected: metaConnection.status === 'CONNECTED',
          status: metaConnection.status,
          message: metaConnection.errorMessage || 'Not connected',
          connection: metaConnection,
          phoneNumbers: metaConnection.phoneNumbers,
          whatsappAccounts: [],
        };
      }

      return {
        isConnected: false,
        status: 'DISCONNECTED',
        message: 'No Meta connection found',
        connection: null,
        whatsappAccounts: [],
        phoneNumbers: [],
      };

    } catch (error: any) {
      console.error('❌ Get connection status error:', error);
      
      return {
        isConnected: false,
        status: 'ERROR',
        message: error.message || 'Failed to get connection status',
        connection: null,
        whatsappAccounts: [],
        phoneNumbers: [],
      };
    }
  }

  /**
   * ✅ DISCONNECT - CLEARS BOTH SYSTEMS
   */
  static async disconnect(organizationId: string) {
    try {
      console.log('🔌 Disconnecting Meta for org:', organizationId);

      await prisma.$transaction(async (tx) => {
        // 1. Update MetaConnection
        await tx.metaConnection.updateMany({
          where: { organizationId },
          data: {
            status: 'DISCONNECTED',
            errorMessage: 'Manually disconnected',
          }
        });

        // 2. Deactivate PhoneNumbers
        const metaConnection = await tx.metaConnection.findUnique({
          where: { organizationId }
        });

        if (metaConnection) {
          await tx.phoneNumber.updateMany({
            where: { metaConnectionId: metaConnection.id },
            data: { isActive: false }
          });
        }

        // 3. Update WhatsAppAccounts
        await tx.whatsAppAccount.updateMany({
          where: { organizationId },
          data: { 
            status: 'DISCONNECTED',
            accessToken: null 
          }
        });

        // 4. Close conversation windows
        await tx.conversation.updateMany({
          where: { organizationId },
          data: {
            isWindowOpen: false,
            windowExpiresAt: new Date()
          }
        });

        // 5. Create activity log
        await tx.activityLog.create({
          data: {
            organizationId,
            action: 'META_DISCONNECTED',
            entity: 'MetaConnection',
            entityId: metaConnection?.id || '',
          },
        });
      });

      console.log('✅ Meta disconnected successfully');

      return { 
        success: true,
        message: 'Meta connection disconnected successfully' 
      };

    } catch (error: any) {
      console.error('❌ Disconnect error:', error);
      throw new AppError('Failed to disconnect Meta account', 500);
    }
  }

  /**
   * ✅ REFRESH CONNECTION
   */
  static async refreshConnection(organizationId: string) {
    const connection = await prisma.metaConnection.findUnique({
      where: { organizationId }
    });

    if (!connection || !connection.accessToken) {
      throw new AppError('No active Meta connection found', 404);
    }

    try {
      // Verify token
      const response = await axios.get(`${GRAPH_API_BASE}/debug_token`, {
        params: {
          input_token: connection.accessToken,
          access_token: `${config.meta.appId}|${config.meta.appSecret}`,
        },
      });

      const isValid = response.data?.data?.is_valid;

      if (!isValid) {
        await this.disconnect(organizationId);
        throw new AppError('Token expired. Please reconnect.', 401);
      }

      // Update last synced
      await prisma.metaConnection.update({
        where: { organizationId },
        data: { lastSyncedAt: new Date() }
      });

      return await this.getConnectionStatus(organizationId);

    } catch (error: any) {
      console.error('❌ Refresh error:', error);
      throw new AppError(error.message || 'Failed to refresh connection', 500);
    }
  }

  // Additional helper methods...
  static async getPhoneNumbers(organizationId: string) {
    const connection = await prisma.metaConnection.findUnique({
      where: { organizationId },
      include: {
        phoneNumbers: {
          where: { isActive: true },
          orderBy: { isPrimary: 'desc' }
        }
      }
    });

    if (!connection) {
      throw new AppError('No Meta connection found', 404);
    }

    return connection.phoneNumbers;
  }
}