// src/modules/meta/meta.service.ts

import prisma from '../../config/database';
import { config } from '../../config';
import { AppError } from '../../middleware/errorHandler';
import { MetaGraphAPI } from './meta.api';

export class MetaService {
  /**
   * ✅ Connect via Embedded Signup
   */
  static async connectEmbeddedSignup(
    organizationId: string,
    code: string,
    state?: string
  ) {
    try {
      console.log('🔄 Starting Embedded Signup connection...');
      console.log('   Organization:', organizationId);
      console.log('   Code:', code.substring(0, 20) + '...');

      // Initialize Meta API
      const metaApi = new MetaGraphAPI();

      // 1. Exchange code for access token
      console.log('🔄 Exchanging code for access token...');
      const tokenResponse = await metaApi.exchangeCodeForToken(code);
      
      let accessToken = tokenResponse.access_token;
      let tokenExpiresAt: Date | null = null;

      console.log('✅ Got access token:', accessToken.substring(0, 20) + '...');

      // 2. Try to get long-lived token (60 days)
      try {
        console.log('🔄 Attempting to get long-lived token...');
        const longTokenResponse = await metaApi.getLongLivedToken(accessToken);
        accessToken = longTokenResponse.access_token;
        
        if (longTokenResponse.expires_in) {
          tokenExpiresAt = new Date(Date.now() + longTokenResponse.expires_in * 1000);
          console.log('✅ Got long-lived token, expires:', tokenExpiresAt);
        }
      } catch (error: any) {
        console.warn('⚠️ Could not get long-lived token:', error.message);
        console.warn('   Using short-lived token (will expire in 1 hour)');
        
        if (tokenResponse.expires_in) {
          tokenExpiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);
        }
      }

      // 3. Debug token to get WABA info
      console.log('🔍 Getting token info and WABA details...');
      const tokenInfo = await metaApi.getTokenInfo(accessToken);
      
      console.log('Token info:', JSON.stringify({
        app_id: tokenInfo.app_id,
        user_id: tokenInfo.user_id,
        scopes: tokenInfo.scopes,
        granular_scopes: tokenInfo.granular_scopes
      }, null, 2));

      // 4. Extract WABA ID from granular scopes
      let wabaId: string | null = null;
      let phoneNumberIds: string[] = [];

      if (tokenInfo.granular_scopes) {
        for (const scope of tokenInfo.granular_scopes) {
          if (scope.scope === 'whatsapp_business_management' && scope.target_ids?.length > 0) {
            wabaId = scope.target_ids[0];
            console.log('📌 Found WABA ID in granular_scopes:', wabaId);
          }

          if (scope.scope === 'whatsapp_business_messaging' && scope.target_ids?.length > 0) {
            phoneNumberIds = scope.target_ids;
            console.log('📞 Found Phone Number IDs:', phoneNumberIds);
          }
        }
      }

      // 5. Fetch WABA details
      if (!wabaId) {
        console.log('⚠️ No WABA ID in granular scopes, trying alternative methods...');
        
        const wabas = await metaApi.getAccessibleWABAs(accessToken);
        
        if (wabas.length === 0) {
          throw new AppError(
            'No WhatsApp Business Account found. Please ensure you selected a business account during signup.',
            400
          );
        }

        wabaId = wabas[0].id;
        console.log('✅ Found WABA via alternative method:', wabaId);
      }

      if (!wabaId) {
        throw new AppError('Failed to obtain WhatsApp Business Account ID.', 400);
      }

      // Get WABA full details
      const wabaDetails = await metaApi.getWABAById(wabaId, accessToken);
      console.log('✅ WABA Details:', {
        id: wabaDetails.id,
        name: wabaDetails.name,
        timezone: wabaDetails.timezone_id
      });

      // 6. Get phone numbers
      console.log('🔄 Fetching phone numbers for WABA...');
      const phoneNumbers = await metaApi.getPhoneNumbers(wabaId, accessToken);

      if (phoneNumbers.length === 0) {
        throw new AppError(
          'No phone numbers found in this WhatsApp Business Account. Please add a phone number in Meta Business Manager.',
          400
        );
      }

      console.log(`✅ Found ${phoneNumbers.length} phone number(s)`);

      // 7. Save to database using transaction
      console.log('💾 Saving Meta connection to database...');

      const result = await prisma.$transaction(async (tx) => {
        // Check if connection already exists
        const existingConnection = await tx.metaConnection.findUnique({
          where: { organizationId }
        });

        let metaConnection;

        if (existingConnection) {
          console.log('🔄 Updating existing Meta connection...');
          
          // Delete old phone numbers first
          await tx.phoneNumber.deleteMany({
            where: { metaConnectionId: existingConnection.id }
          });
          
          // Update connection
          metaConnection = await tx.metaConnection.update({
            where: { organizationId },
            data: {
              accessToken,
              accessTokenExpiresAt: tokenExpiresAt,
              wabaId,
              wabaName: wabaDetails.name || null,
              businessId: wabaDetails.owner_business_info?.id || null,
              status: 'CONNECTED',
              lastSyncedAt: new Date(),
              errorMessage: null,
              webhookVerified: true,
              messagingLimit: wabaDetails.messaging_limit_tier || null,
              qualityRating: wabaDetails.quality_rating || null,
            },
          });
        } else {
          console.log('✨ Creating new Meta connection...');
          
          metaConnection = await tx.metaConnection.create({
            data: {
              organizationId,
              accessToken,
              accessTokenExpiresAt: tokenExpiresAt,
              wabaId,
              wabaName: wabaDetails.name || null,
              businessId: wabaDetails.owner_business_info?.id || null,
              status: 'CONNECTED',
              lastSyncedAt: new Date(),
              webhookVerified: true,
              messagingLimit: wabaDetails.messaging_limit_tier || null,
              qualityRating: wabaDetails.quality_rating || null,
            },
          });
        }

        // 8. Save phone numbers
        console.log('💾 Saving phone numbers...');
        
        const savedPhoneNumbers = [];
        for (let i = 0; i < phoneNumbers.length; i++) {
          const phone = phoneNumbers[i];
          
          const savedPhone = await tx.phoneNumber.create({
            data: {
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
          console.log(`   ✅ Saved phone: ${phone.display_phone_number || phone.id}`);
        }

        // ✅ Create/Update WhatsAppAccount for backward compatibility
        if (savedPhoneNumbers.length > 0) {
          const primaryPhone = savedPhoneNumbers[0];
          
          await tx.whatsAppAccount.upsert({
            where: { phoneNumberId: primaryPhone.phoneNumberId },
            update: {
              organizationId,
              wabaId,
              phoneNumber: primaryPhone.phoneNumber,
              displayName: primaryPhone.displayName || 'WhatsApp',
              accessToken,
              tokenExpiresAt,
              status: 'CONNECTED',
              isDefault: true,
            },
            create: {
              organizationId,
              phoneNumberId: primaryPhone.phoneNumberId,
              wabaId,
              phoneNumber: primaryPhone.phoneNumber,
              displayName: primaryPhone.displayName || 'WhatsApp',
              accessToken,
              tokenExpiresAt,
              status: 'CONNECTED',
              isDefault: true,
            },
          });
          
          console.log('✅ WhatsAppAccount synced for backward compatibility');
        }

        // 9. Create activity log
        await tx.activityLog.create({
          data: {
            organizationId,
            action: 'META_CONNECTED',
            entity: 'MetaConnection',
            entityId: metaConnection.id,
            metadata: {
              wabaId,
              wabaName: wabaDetails.name,
              phoneCount: phoneNumbers.length,
              phoneNumbers: savedPhoneNumbers.map(p => ({
                id: p.phoneNumberId,
                number: p.phoneNumber
              }))
            },
          },
        });

        return { metaConnection, phoneNumbers: savedPhoneNumbers };
      });

      console.log('✅ Meta connection completed successfully!');
      console.log('   Connection ID:', result.metaConnection.id);
      console.log('   WABA ID:', result.metaConnection.wabaId);
      console.log('   Phone Count:', result.phoneNumbers.length);

      // Return formatted response
      return {
        id: result.metaConnection.id,
        organizationId: result.metaConnection.organizationId,
        wabaId: result.metaConnection.wabaId,
        wabaName: result.metaConnection.wabaName,
        status: result.metaConnection.status,
        phoneNumbers: result.phoneNumbers.map(phone => ({
          id: phone.id,
          phoneNumberId: phone.phoneNumberId,
          phoneNumber: phone.phoneNumber,
          displayName: phone.displayName,
          isPrimary: phone.isPrimary,
          isActive: phone.isActive,
        })),
        lastSyncedAt: result.metaConnection.lastSyncedAt,
        webhookVerified: result.metaConnection.webhookVerified,
      };

    } catch (error: any) {
      console.error('❌ Meta connection error:', error);
      console.error('Error stack:', error.stack);

      // Save error to database
      try {
        await prisma.metaConnection.upsert({
          where: { organizationId },
          update: {
            status: 'ERROR',
            errorMessage: error.message || 'Connection failed',
          },
          create: {
            organizationId,
            accessToken: '',
            wabaId: '',
            status: 'ERROR',
            errorMessage: error.message || 'Connection failed',
          },
        });
      } catch (dbError) {
        console.error('Failed to save error to database:', dbError);
      }

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        error.message || 'Failed to connect Meta account. Please try again.',
        500
      );
    }
  }

  /**
   * ✅ Get current Meta connection status (UPDATED)
   */
  static async getConnectionStatus(organizationId: string) {
    try {
      console.log('🔍 Checking connection status for org:', organizationId);

      // Check MetaConnection first
      const connection = await prisma.metaConnection.findUnique({
        where: { organizationId },
        include: {
          phoneNumbers: {
            where: { isActive: true },
            orderBy: { isPrimary: 'desc' }
          }
        }
      });

      // ✅ Also check WhatsAppAccount for backward compatibility
      const whatsappAccounts = await prisma.whatsAppAccount.findMany({
        where: { 
          organizationId,
          status: 'CONNECTED'
        },
        select: {
          id: true,
          phoneNumber: true,
          displayName: true,
          status: true,
          phoneNumberId: true,
          wabaId: true,
          isDefault: true,
        },
        orderBy: { isDefault: 'desc' }
      });

      console.log('   MetaConnection:', connection ? 'Found' : 'Not found');
      console.log('   WhatsApp Accounts:', whatsappAccounts.length);

      // ✅ If WhatsApp accounts exist, we're connected!
      if (whatsappAccounts.length > 0) {
        console.log('✅ Found', whatsappAccounts.length, 'connected WhatsApp account(s)');
        
        // If MetaConnection has error but WhatsApp accounts exist, fix it
        if (connection && connection.status === 'ERROR') {
          await prisma.metaConnection.update({
            where: { organizationId },
            data: { 
              status: 'CONNECTED',
              errorMessage: null 
            }
          });
        }

        return {
          isConnected: true,
          status: 'CONNECTED',
          message: 'WhatsApp connected',
          connection: connection || null,
          whatsappAccounts,
          phoneNumbers: whatsappAccounts.map(acc => ({
            id: acc.id,
            phoneNumber: acc.phoneNumber,
            displayName: acc.displayName,
            isDefault: acc.isDefault,
          })),
          phoneCount: whatsappAccounts.length,
          primaryAccount: whatsappAccounts[0],
        };
      }

      // Check MetaConnection
      if (connection) {
        // Check token expiry
        if (connection.accessTokenExpiresAt && connection.accessTokenExpiresAt < new Date()) {
          await prisma.metaConnection.update({
            where: { organizationId },
            data: {
              status: 'TOKEN_EXPIRED',
              errorMessage: 'Access token expired. Please reconnect.'
            }
          });

          return {
            isConnected: false,
            status: 'TOKEN_EXPIRED',
            message: 'Access token expired. Please reconnect.',
            connection
          };
        }

        return {
          isConnected: connection.status === 'CONNECTED',
          status: connection.status,
          message: connection.status === 'CONNECTED' 
            ? 'Connected' 
            : connection.errorMessage || 'Not connected',
          connection: {
            ...connection,
            phoneCount: connection.phoneNumbers.length,
            primaryPhone: connection.phoneNumbers[0] || null
          },
          phoneNumbers: connection.phoneNumbers,
          whatsappAccounts: [],
        };
      }

      // No connection found
      console.log('⚠️ No connection found');
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
      
      // ✅ On error, still try to check WhatsApp accounts (fallback)
      try {
        const whatsappAccounts = await prisma.whatsAppAccount.findMany({
          where: { 
            organizationId,
            status: 'CONNECTED'
          }
        });

        if (whatsappAccounts.length > 0) {
          console.log('✅ Fallback: Found WhatsApp accounts');
          return {
            isConnected: true,
            status: 'CONNECTED',
            message: 'WhatsApp connected (fallback)',
            connection: null,
            whatsappAccounts,
            phoneNumbers: whatsappAccounts.map(acc => ({
              phoneNumber: acc.phoneNumber,
              displayName: acc.displayName,
            })),
          };
        }
      } catch (fallbackError) {
        console.error('Fallback check also failed:', fallbackError);
      }
      
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
   * Get connected phone numbers
   */
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

    return connection.phoneNumbers.map(phone => ({
      id: phone.id,
      phoneNumberId: phone.phoneNumberId,
      phoneNumber: phone.phoneNumber,
      displayName: phone.displayName,
      verifiedName: phone.verifiedName,
      qualityRating: phone.qualityRating,
      isPrimary: phone.isPrimary,
      isActive: phone.isActive,
      messagesLimit: phone.messagesLimit,
      messagesUsed: phone.messagesUsed,
      lastResetAt: phone.lastResetAt,
    }));
  }

  /**
   * Register a phone number for messaging
   */
  static async registerPhoneNumber(
    organizationId: string,
    phoneNumberId: string,
    pin?: string
  ) {
    const connection = await prisma.metaConnection.findUnique({
      where: { organizationId }
    });

    if (!connection || !connection.accessToken) {
      throw new AppError('No active Meta connection found', 404);
    }

    try {
      const metaApi = new MetaGraphAPI(connection.accessToken);
      
      // Register phone number with Meta
      const result = await metaApi.registerPhoneNumber(phoneNumberId, pin);

      console.log('✅ Phone number registered:', phoneNumberId);

      return {
        success: true,
        phoneNumberId,
        ...result
      };
    } catch (error: any) {
      console.error('❌ Register phone number error:', error);
      throw new AppError(error.message || 'Failed to register phone number', 500);
    }
  }

  /**
   * Send test message
   */
  static async sendTestMessage(
    organizationId: string,
    phoneNumberId: string,
    to: string,
    message: string
  ) {
    const connection = await prisma.metaConnection.findUnique({
      where: { organizationId },
      include: {
        phoneNumbers: {
          where: { phoneNumberId, isActive: true }
        }
      }
    });

    if (!connection || !connection.accessToken) {
      throw new AppError('No active Meta connection found', 404);
    }

    if (connection.phoneNumbers.length === 0) {
      throw new AppError('Phone number not found or inactive', 404);
    }

    try {
      const metaApi = new MetaGraphAPI(connection.accessToken);
      
      // Send test message
      const result = await metaApi.sendTextMessage(phoneNumberId, to, message);

      console.log('✅ Test message sent:', result.messages[0].id);

      return {
        success: true,
        messageId: result.messages[0].id,
        ...result
      };
    } catch (error: any) {
      console.error('❌ Send test message error:', error);
      throw new AppError(error.message || 'Failed to send test message', 500);
    }
  }

  /**
   * Get linked business accounts
   */
  static async getBusinessAccounts(organizationId: string) {
    const connection = await prisma.metaConnection.findUnique({
      where: { organizationId }
    });

    if (!connection || !connection.accessToken) {
      throw new AppError('No active Meta connection found', 404);
    }

    try {
      const metaApi = new MetaGraphAPI(connection.accessToken);
      
      // Get accessible WABAs
      const wabas = await metaApi.getAccessibleWABAs(connection.accessToken);

      return wabas.map((waba: any) => ({
        id: waba.id,
        name: waba.name,
        currency: waba.currency,
        timezone: waba.timezone_id,
        messagingLimit: waba.messaging_limit_tier,
        qualityRating: waba.quality_rating,
      }));
    } catch (error: any) {
      console.error('❌ Get business accounts error:', error);
      throw new AppError(error.message || 'Failed to get business accounts', 500);
    }
  }

  /**
   * Disconnect Meta account
   */
  static async disconnect(organizationId: string) {
    const connection = await prisma.metaConnection.findUnique({
      where: { organizationId }
    });

    if (!connection) {
      throw new AppError('No Meta connection found', 404);
    }

    await prisma.$transaction(async (tx) => {
      // Update connection status
      await tx.metaConnection.update({
        where: { organizationId },
        data: {
          status: 'DISCONNECTED',
          errorMessage: 'Manually disconnected'
        }
      });

      // Deactivate phone numbers
      await tx.phoneNumber.updateMany({
        where: { metaConnectionId: connection.id },
        data: { isActive: false }
      });

      // Update WhatsApp accounts
      await tx.whatsAppAccount.updateMany({
        where: { organizationId },
        data: { status: 'DISCONNECTED' }
      });

      // Log activity
      await tx.activityLog.create({
        data: {
          organizationId,
          action: 'META_DISCONNECTED',
          entity: 'MetaConnection',
          entityId: connection.id,
        },
      });
    });

    console.log('✅ Meta disconnected for org:', organizationId);

    return { message: 'Meta connection disconnected successfully' };
  }

  /**
   * Refresh connection data
   */
  static async refreshConnection(organizationId: string) {
    const connection = await prisma.metaConnection.findUnique({
      where: { organizationId }
    });

    if (!connection || !connection.accessToken) {
      throw new AppError('No active Meta connection found', 404);
    }

    try {
      const metaApi = new MetaGraphAPI(connection.accessToken);

      // Refresh WABA details
      const wabaDetails = await metaApi.getWABAById(connection.wabaId, connection.accessToken);

      // Refresh phone numbers
      const phoneNumbers = await metaApi.getPhoneNumbers(connection.wabaId, connection.accessToken);

      // Update connection
      await prisma.metaConnection.update({
        where: { organizationId },
        data: {
          wabaName: wabaDetails.name || null,
          qualityRating: wabaDetails.quality_rating || null,
          messagingLimit: wabaDetails.messaging_limit_tier || null,
          lastSyncedAt: new Date(),
          status: 'CONNECTED', // ✅ Fix status if it was error
          errorMessage: null,
        }
      });

      // Update phone numbers
      for (const phone of phoneNumbers) {
        await prisma.phoneNumber.upsert({
          where: { phoneNumberId: phone.id },
          update: {
            phoneNumber: phone.display_phone_number || phone.verified_name || '',
            displayName: phone.verified_name || null,
            qualityRating: phone.quality_rating || null,
            verifiedName: phone.verified_name || null,
            isActive: true,
          },
          create: {
            metaConnectionId: connection.id,
            phoneNumberId: phone.id,
            phoneNumber: phone.display_phone_number || phone.verified_name || '',
            displayName: phone.verified_name || null,
            qualityRating: phone.quality_rating || null,
            verifiedName: phone.verified_name || null,
            isActive: true,
            isPrimary: false,
          }
        });
      }

      console.log('✅ Meta connection refreshed successfully');

      return this.getConnectionStatus(organizationId);

    } catch (error: any) {
      console.error('❌ Refresh connection error:', error);

      await prisma.metaConnection.update({
        where: { organizationId },
        data: {
          status: 'ERROR',
          errorMessage: error.message || 'Refresh failed'
        }
      });

      throw new AppError(error.message || 'Failed to refresh connection', 500);
    }
  }
}