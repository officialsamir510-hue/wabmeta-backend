// src/modules/meta/meta.service.ts

import prisma from '../../config/database';
import { config } from '../../config';
import { AppError } from '../../middleware/errorHandler';
import { MetaGraphAPI } from './meta.api';

export class MetaService {
  /**
   * ✅ NEW: Connect via Embedded Signup
   * This handles the code from Meta's embedded signup flow
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

      // 3. Debug token to get WABA info (Embedded Signup stores it here)
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
          // Look for WABA in whatsapp_business_management
          if (scope.scope === 'whatsapp_business_management' && scope.target_ids?.length > 0) {
            wabaId = scope.target_ids[0];
            console.log('📌 Found WABA ID in granular_scopes:', wabaId);
          }

          // Get phone number IDs
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

      // Ensure wabaId is not null before proceeding
      if (!wabaId) {
        throw new AppError(
          'Failed to obtain WhatsApp Business Account ID.',
          400
        );
      }

      // Get WABA full details
      const wabaDetails = await metaApi.getWABAById(wabaId as string, accessToken);
      console.log('✅ WABA Details:', {
        id: wabaDetails.id,
        name: wabaDetails.name,
        timezone: wabaDetails.timezone_id
      });

      // 6. Get phone numbers
      console.log('🔄 Fetching phone numbers for WABA...');
      const phoneNumbers = await metaApi.getPhoneNumbers(wabaId as string, accessToken);

      if (phoneNumbers.length === 0) {
        throw new AppError(
          'No phone numbers found in this WhatsApp Business Account. Please add a phone number in Meta Business Manager.',
          400
        );
      }

      console.log(`✅ Found ${phoneNumbers.length} phone number(s)`);

      // 7. Save to database
      console.log('💾 Saving Meta connection to database...');

      // Check if connection already exists
      const existingConnection = await prisma.metaConnection.findUnique({
        where: { organizationId },
        include: { phoneNumbers: true }
      });

      let metaConnection;

      if (existingConnection) {
        console.log('🔄 Updating existing Meta connection...');
        
        // Update existing connection
        metaConnection = await prisma.metaConnection.update({
          where: { organizationId },
          data: {
            accessToken,
            accessTokenExpiresAt: tokenExpiresAt,
            wabaId: wabaId || undefined,
            wabaName: wabaDetails.name || null,
            businessId: wabaDetails.owner_business_info?.id || null,
            status: 'CONNECTED',
            lastSyncedAt: new Date(),
            errorMessage: null,
            webhookVerified: true,
          },
        });

        // Delete old phone numbers
        await prisma.phoneNumber.deleteMany({
          where: { metaConnectionId: metaConnection.id }
        });

      } else {
        console.log('✨ Creating new Meta connection...');
        
        metaConnection = await prisma.metaConnection.create({
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
          },
        });
      }

      // 8. Save phone numbers
      console.log('💾 Saving phone numbers...');
      
      for (let i = 0; i < phoneNumbers.length; i++) {
        const phone = phoneNumbers[i];
        
        await prisma.phoneNumber.create({
          data: {
            metaConnectionId: metaConnection.id,
            phoneNumberId: phone.id,
            phoneNumber: phone.display_phone_number || phone.verified_name || '',
            displayName: phone.verified_name || null,
            qualityRating: phone.quality_rating || null,
            verifiedName: phone.verified_name || null,
            isActive: true,
            isPrimary: i === 0, // First number is primary
          },
        });

        console.log(`   ✅ Saved phone: ${phone.display_phone_number}`);
      }

      // 9. Create activity log
      await prisma.activityLog.create({
        data: {
          organizationId,
          action: 'META_CONNECTED',
          entity: 'MetaConnection',
          entityId: metaConnection.id,
          metadata: {
            wabaId,
            wabaName: wabaDetails.name,
            phoneCount: phoneNumbers.length,
          },
        },
      });

      console.log('✅ Meta connection completed successfully!');

      // Return connection with phone numbers
      return prisma.metaConnection.findUnique({
        where: { id: metaConnection.id },
        include: {
          phoneNumbers: {
            where: { isActive: true },
            orderBy: { isPrimary: 'desc' }
          }
        }
      });

    } catch (error: any) {
      console.error('❌ Meta connection error:', error);

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
   * Get current Meta connection status
   */
  static async getConnectionStatus(organizationId: string) {
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
      return {
        isConnected: false,
        status: 'DISCONNECTED',
        message: 'No Meta connection found'
      };
    }

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
      connection
    };
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

    // Update status
    await prisma.metaConnection.update({
      where: { organizationId },
      data: {
        status: 'DISCONNECTED',
        accessToken: undefined,
        accessTokenExpiresAt: null,
        errorMessage: 'Manually disconnected'
      }
    });

    // Deactivate phone numbers
    await prisma.phoneNumber.updateMany({
      where: { metaConnectionId: connection.id },
      data: { isActive: false }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        organizationId,
        action: 'META_DISCONNECTED',
        entity: 'MetaConnection',
        entityId: connection.id,
      },
    });

    return { message: 'Meta connection disconnected successfully' };
  }

  /**
   * Refresh connection data (sync WABA details, phone numbers, etc.)
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
          qualityRating: wabaDetails.account_review_status || null,
          lastSyncedAt: new Date(),
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