// 📁 src/modules/meta/meta.controller.ts - COMPLETE FINAL VERSION

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../middleware/errorHandler';
import { sendSuccess } from '../../utils/response';
import prisma from '../../config/database';
import crypto from 'crypto';
import axios from 'axios';

// Helper to safely get organization ID from headers
const getOrgId = (req: Request): string => {
  const header = req.headers['x-organization-id'];
  if (!header) return '';
  return Array.isArray(header) ? header[0] : header;
};

// Extended Request interface
interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    organizationId?: string;
  };
}

export class MetaController {
  // ============================================
  // GET OAUTH URL (Initiate Connection)
  // ============================================
  async getOAuthUrl(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // Multiple sources for organization ID
      const organizationId =
        (req.query.organizationId as string) ||
        req.body.organizationId ||
        req.user?.organizationId;

      // Detailed logging
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔍 Meta OAuth URL Request');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Query params:', req.query);
      console.log('Body:', req.body);
      console.log('User:', req.user?.id);
      console.log('Organization ID:', organizationId);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      if (!organizationId) {
        console.error('❌ No organization ID provided');
        throw new AppError('Organization ID is required', 400);
      }

      // Verify organization exists
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
      });

      if (!organization) {
        console.error('❌ Organization not found:', organizationId);
        throw new AppError('Organization not found', 404);
      }

      console.log('✅ Organization found:', organization.name);

      // Verify user permissions
      const userId = req.user?.id;
      if (userId) {
        const membership = await prisma.organizationMember.findFirst({
          where: {
            organizationId,
            userId,
            role: { in: ['OWNER', 'ADMIN'] },
          },
        });

        if (!membership) {
          throw new AppError('You do not have permission to connect WhatsApp', 403);
        }
      }

      // Generate secure state
      const state = `${organizationId}:${crypto.randomBytes(32).toString('hex')}`;

      // Save state with expiry (10 minutes)
      await (prisma as any).oAuthState.create({
        data: {
          state,
          organizationId,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      });

      // Clean up expired states
      await (prisma as any).oAuthState.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });

      console.log('✅ OAuth state created');

      // Build Meta Embedded Signup URL (v25.0)
      const metaAuthUrl = new URL('https://www.facebook.com/v25.0/dialog/oauth');

      metaAuthUrl.searchParams.set('client_id', process.env.META_APP_ID!);
      metaAuthUrl.searchParams.set('config_id', process.env.META_CONFIG_ID!);
      metaAuthUrl.searchParams.set('state', state);
      metaAuthUrl.searchParams.set('response_type', 'code');
      metaAuthUrl.searchParams.set('override_default_response_type', 'true');

      // Embedded Signup specific params
      metaAuthUrl.searchParams.set('auth_type', '');
      metaAuthUrl.searchParams.set('display', 'popup');

      // Extras for Embedded Signup v3
      const extras = JSON.stringify({
        featureType: 'whatsapp_business_app_onboarding',
        sessionInfoVersion: '3',
        version: 'v3',
        partner_data: null,
        is_hosted_es: true,
      });
      metaAuthUrl.searchParams.set('extras', extras);

      // Redirect URIs
      const redirectUri = `${process.env.FRONTEND_URL}/meta/callback`;
      const fallbackRedirectUri = `https://business.facebook.com/messaging/hosted_es/oauth_callback/?app_id=${process.env.META_APP_ID}&config_id=${process.env.META_CONFIG_ID}&extras=${encodeURIComponent(extras)}`;

      metaAuthUrl.searchParams.set('redirect_uri', redirectUri);
      metaAuthUrl.searchParams.set('fallback_redirect_uri', fallbackRedirectUri);

      // Scopes
      metaAuthUrl.searchParams.set(
        'scope',
        'whatsapp_business_management,whatsapp_business_messaging,business_management'
      );

      console.log('✅ OAuth URL generated');

      return sendSuccess(res, {
        url: metaAuthUrl.toString(),
        authUrl: metaAuthUrl.toString(), // For compatibility
        state,
      }, 'OAuth URL generated');

    } catch (error: any) {
      console.error('❌ getOAuthUrl failed:', error);
      next(error);
    }
  }

  // Alias for getOAuthUrl
  async initiateConnection(req: AuthRequest, res: Response, next: NextFunction) {
    return this.getOAuthUrl(req, res, next);
  }

  async getAuthUrl(req: AuthRequest, res: Response, next: NextFunction) {
    return this.getOAuthUrl(req, res, next);
  }

  // ============================================
  // HANDLE CALLBACK (Complete Connection)
  // ============================================
  async handleCallback(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { code, state } = req.body;

      console.log('\n🔄 ========== META CALLBACK ==========');
      console.log('   Code:', code ? `${code.substring(0, 10)}...` : 'Missing');
      console.log('   State:', state ? `${state.substring(0, 20)}...` : 'Missing');

      if (!code) {
        throw new AppError('Authorization code is required', 400);
      }

      if (!state) {
        throw new AppError('State parameter is required', 400);
      }

      // Verify state
      const oauthState = await (prisma as any).oAuthState.findUnique({
        where: { state },
      });

      if (!oauthState) {
        console.error('❌ Invalid state token');
        throw new AppError('Invalid or expired state token', 400);
      }

      if (oauthState.expiresAt < new Date()) {
        await (prisma as any).oAuthState.delete({ where: { state } });
        console.error('❌ State token expired');
        throw new AppError('State token expired. Please try again.', 400);
      }

      const organizationId = oauthState.organizationId;
      console.log('   Organization ID:', organizationId);

      // Verify user permissions
      const userId = req.user?.id;
      if (userId) {
        const membership = await prisma.organizationMember.findFirst({
          where: {
            organizationId,
            userId,
            role: { in: ['OWNER', 'ADMIN'] },
          },
        });

        if (!membership) {
          throw new AppError('You do not have permission to connect WhatsApp', 403);
        }
      }

      console.log('📊 Step 1: Exchanging code for access token...');

      // Exchange code for access token
      const tokenResponse = await axios.get(
        `https://graph.facebook.com/v25.0/oauth/access_token`,
        {
          params: {
            client_id: process.env.META_APP_ID,
            client_secret: process.env.META_APP_SECRET,
            code,
            redirect_uri: `${process.env.FRONTEND_URL}/meta/callback`,
          },
        }
      );

      const { access_token } = tokenResponse.data;
      console.log('   ✅ Access token obtained');

      console.log('📊 Step 2: Getting WABA ID from token...');

      // Get WABA ID from token debug
      const debugTokenResponse = await axios.get(
        `https://graph.facebook.com/v25.0/debug_token`,
        {
          params: {
            input_token: access_token,
            access_token: `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`,
          },
        }
      );

      const wabaId = debugTokenResponse.data.data.granular_scopes?.find(
        (s: any) => s.scope === 'whatsapp_business_management'
      )?.target_ids?.[0];

      if (!wabaId) {
        console.error('❌ WABA ID not found in token');
        throw new AppError(
          'WABA ID not found. Please complete the setup in Meta Business Suite.',
          400
        );
      }

      console.log('   ✅ WABA ID:', wabaId);

      console.log('📊 Step 3: Fetching WABA details...');

      // Get WABA details
      const wabaDetails = await axios.get(
        `https://graph.facebook.com/v25.0/${wabaId}`,
        {
          params: {
            fields: 'id,name,currency,timezone_id,message_template_namespace',
            access_token,
          },
        }
      );

      console.log('   ✅ WABA Name:', wabaDetails.data.name);

      console.log('📊 Step 4: Fetching phone numbers...');

      // Get phone numbers
      const phoneNumbersResponse = await axios.get(
        `https://graph.facebook.com/v25.0/${wabaId}/phone_numbers`,
        {
          params: {
            access_token,
          },
        }
      );

      const phoneNumbers = phoneNumbersResponse.data.data || [];
      console.log('   ✅ Phone numbers found:', phoneNumbers.length);

      if (phoneNumbers.length === 0) {
        console.warn('⚠️ No phone numbers found for WABA');
      }

      console.log('📊 Step 5: Saving to database...');

      // Save WhatsAppAccount (primary model)
      let savedAccount = null;
      if (phoneNumbers.length > 0) {
        const primaryPhone = phoneNumbers[0];

        savedAccount = await prisma.whatsAppAccount.upsert({
          where: {
            phoneNumberId: primaryPhone.id,
          },
          update: {
            status: 'CONNECTED',
            phoneNumber: primaryPhone.display_phone_number,
            displayName: primaryPhone.verified_name,
            qualityRating: primaryPhone.quality_rating,
            accessToken: access_token,
          },
          create: {
            organizationId,
            phoneNumberId: primaryPhone.id,
            wabaId,
            accessToken: access_token,
            phoneNumber: primaryPhone.display_phone_number,
            displayName: primaryPhone.verified_name,
            qualityRating: primaryPhone.quality_rating,
            status: 'CONNECTED',
            isDefault: true,
          },
        });

        console.log('   ✅ WhatsAppAccount saved');
      }

      // Save MetaConnection (if model exists)
      let savedMetaConnection = null;
      try {
        savedMetaConnection = await (prisma as any).metaConnection.upsert({
          where: { organizationId },
          update: {
            accessToken: access_token,
            wabaId,
            wabaName: wabaDetails.data.name,
            status: 'CONNECTED',
            lastSyncedAt: new Date(),
          },
          create: {
            organizationId,
            accessToken: access_token,
            wabaId,
            wabaName: wabaDetails.data.name,
            status: 'CONNECTED',
          },
        });
        console.log('   ✅ MetaConnection saved');
      } catch (e) {
        console.log('   ⚠️ MetaConnection model not available (optional)');
      }

      // Save PhoneNumbers (if model exists)
      const savedPhoneNumbers = [];
      try {
        for (const phone of phoneNumbers) {
          const savedPhone = await (prisma as any).phoneNumber.upsert({
            where: { phoneNumberId: phone.id },
            update: {
              phoneNumber: phone.display_phone_number,
              displayName: phone.verified_name,
              qualityRating: phone.quality_rating,
              verifiedName: phone.verified_name,
              isActive: true,
            },
            create: {
              metaConnectionId: savedMetaConnection?.id,
              phoneNumberId: phone.id,
              phoneNumber: phone.display_phone_number,
              displayName: phone.verified_name,
              qualityRating: phone.quality_rating,
              verifiedName: phone.verified_name,
              isActive: true,
              isPrimary: phoneNumbers[0].id === phone.id, // First is primary
            },
          });
          savedPhoneNumbers.push(savedPhone);
        }
        console.log('   ✅ PhoneNumbers saved');
      } catch (e: any) {
        console.log('   ⚠️ PhoneNumber model not available:', e.message);
      }

      // Delete used state
      await (prisma as any).oAuthState.delete({ where: { state } });

      console.log('✅ Meta callback successful');
      console.log('🔄 ========== META CALLBACK END ==========\n');

      return sendSuccess(
        res,
        {
          wabaId,
          wabaName: wabaDetails.data.name,
          phoneNumbers: phoneNumbers.map((p: any) => ({
            id: p.id,
            phoneNumber: p.display_phone_number,
            displayName: p.verified_name,
            qualityRating: p.quality_rating,
          })),
          phoneNumberCount: phoneNumbers.length,
          account: savedAccount,
        },
        'WhatsApp account connected successfully'
      );
    } catch (error: any) {
      console.error('❌ Meta callback error:', error);

      // Provide specific error messages
      if (error.response?.data) {
        console.error('   Meta API Error:', error.response.data);
        const apiError = error.response.data.error;
        throw new AppError(
          apiError?.message || 'Meta API error',
          error.response.status || 500
        );
      }

      next(error);
    }
  }

  // ============================================
  // GET ACCOUNTS (OLD METHOD - WHATSAPPACCOUNT ONLY)
  // ============================================
  async getAccounts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = getOrgId(req) || req.query.organizationId as string;

      if (!organizationId) {
        throw new AppError('Organization ID is required', 400);
      }

      const orgIdString = Array.isArray(organizationId) ? organizationId[0] : organizationId;
      console.log('📋 Fetching accounts (old method) for org:', orgIdString);

      const accounts = await prisma.whatsAppAccount.findMany({
        where: { organizationId: orgIdString },
        orderBy: { createdAt: 'desc' },
      });

      console.log('   Found accounts:', accounts.length);

      return sendSuccess(res, { accounts }, 'Accounts fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // GET WHATSAPP ACCOUNTS (NEW METHOD - SUPPORTS BOTH STRUCTURES)
  // ============================================
  async getWhatsAppAccounts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { organizationId } = req.params;

      console.log('\n📋 Fetching WhatsApp accounts for org:', organizationId);

      if (!organizationId) {
        throw new AppError('Organization ID is required', 400);
      }

      let accounts: any[] = [];

      // METHOD 1: Check MetaConnection + PhoneNumber (New structure)
      try {
        const metaConnection = await (prisma as any).metaConnection.findUnique({
          where: { organizationId },
          include: {
            phoneNumbers: {
              where: { isActive: true },
              orderBy: { isPrimary: 'desc' },
            },
          },
        });

        if (metaConnection && metaConnection.phoneNumbers && metaConnection.phoneNumbers.length > 0) {
          console.log('✅ Found MetaConnection with phones:', metaConnection.phoneNumbers.length);

          accounts = metaConnection.phoneNumbers.map((phone: any) => ({
            id: phone.id,
            phoneNumberId: phone.phoneNumberId,
            phoneNumber: phone.phoneNumber,
            displayName: phone.displayName,
            verifiedName: phone.verifiedName,
            qualityRating: phone.qualityRating,
            isPrimary: phone.isPrimary,
            isActive: phone.isActive,
            wabaId: metaConnection.wabaId,
            wabaName: metaConnection.wabaName,
          }));

          console.log('📤 Returning accounts from MetaConnection:', accounts.length);
          return sendSuccess(res, { accounts }, 'Accounts fetched successfully');
        }
      } catch (e: any) {
        console.log('⚠️ MetaConnection check failed:', e.message);
      }

      // METHOD 2: Check WhatsAppAccount table (Fallback)
      console.log('⚠️ No MetaConnection found, checking WhatsAppAccount table...');

      const orgIdString = Array.isArray(organizationId) ? organizationId[0] : organizationId;
      const whatsappAccounts = await prisma.whatsAppAccount.findMany({
        where: {
          organizationId: orgIdString,
          status: 'CONNECTED'
        },
        orderBy: { createdAt: 'desc' },
      });

      if (whatsappAccounts.length > 0) {
        console.log('✅ Found WhatsAppAccounts:', whatsappAccounts.length);
        accounts = whatsappAccounts.map((acc: any) => ({
          id: acc.id,
          phoneNumberId: acc.phoneNumberId,
          phoneNumber: acc.phoneNumber,
          displayName: acc.displayName,
          verifiedName: acc.verifiedName,
          qualityRating: acc.qualityRating,
          wabaId: acc.wabaId,
          isActive: acc.status === 'CONNECTED',
        }));
      }

      console.log('📤 Returning accounts:', accounts.length);

      return sendSuccess(res, { accounts }, 'Accounts fetched successfully');

    } catch (error: any) {
      console.error('❌ Get WhatsApp accounts error:', error);
      next(error);
    }
  }

  // ============================================
  // GET CONNECTION STATUS
  // ============================================
  async getConnectionStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { organizationId } = req.params;

      if (!organizationId) {
        throw new AppError('Organization ID is required', 400);
      }

      console.log('🔍 Checking connection status for org:', organizationId);

      // Check MetaConnection
      let isConnected = false;
      let status = 'NOT_CONNECTED';
      let details: any = null;

      try {
        const metaConnection = await (prisma as any).metaConnection.findUnique({
          where: { organizationId },
          include: {
            phoneNumbers: {
              where: { isActive: true },
            },
          },
        });

        if (metaConnection) {
          isConnected = metaConnection.status === 'CONNECTED';
          status = metaConnection.status;
          details = {
            wabaId: metaConnection.wabaId,
            wabaName: metaConnection.wabaName,
            phoneNumbers: metaConnection.phoneNumbers?.length || 0,
            lastSyncedAt: metaConnection.lastSyncedAt,
          };
        }
      } catch (e) {
        console.log('⚠️ MetaConnection not available, checking WhatsAppAccount');
      }

      // Fallback to WhatsAppAccount
      if (!isConnected) {
        const orgIdString = Array.isArray(organizationId) ? organizationId[0] : organizationId;
        const whatsappAccount = await prisma.whatsAppAccount.findFirst({
          where: { organizationId: orgIdString, status: 'CONNECTED' },
        });

        if (whatsappAccount) {
          isConnected = true;
          status = 'CONNECTED';
          details = {
            wabaId: whatsappAccount.wabaId,
            phoneNumber: whatsappAccount.phoneNumber,
            displayName: whatsappAccount.displayName,
          };
        }
      }

      return sendSuccess(res, {
        isConnected,
        status,
        ...details,
      }, 'Connection status fetched');

    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // GET SINGLE ACCOUNT
  // ============================================
  async getAccount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const organizationId = getOrgId(req);

      if (!organizationId) {
        throw new AppError('Organization ID is required', 400);
      }

      const account = await prisma.whatsAppAccount.findFirst({
        where: { id, organizationId },
      });

      if (!account) {
        throw new AppError('Account not found', 404);
      }

      return sendSuccess(res, account, 'Account fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // DISCONNECT ACCOUNT
  // ============================================
  async disconnectAccount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const organizationId = getOrgId(req);

      if (!organizationId) {
        throw new AppError('Organization ID is required', 400);
      }

      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('Authentication required', 401);
      }

      const membership = await prisma.organizationMember.findFirst({
        where: {
          organizationId,
          userId,
          role: { in: ['OWNER', 'ADMIN'] },
        },
      });

      if (!membership) {
        throw new AppError('You do not have permission to disconnect', 403);
      }

      await prisma.whatsAppAccount.update({
        where: { id },
        data: { status: 'DISCONNECTED' },
      });

      // Also disconnect MetaConnection if exists
      try {
        await (prisma as any).metaConnection.update({
          where: { organizationId },
          data: { status: 'DISCONNECTED' },
        });
      } catch (e) {
        console.log('⚠️ MetaConnection not updated (may not exist)');
      }

      return sendSuccess(res, { success: true }, 'Account disconnected successfully');
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // GET EMBEDDED SIGNUP CONFIG
  // ============================================
  async getEmbeddedSignupConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const config = {
        appId: process.env.META_APP_ID,
        configId: process.env.META_CONFIG_ID,
        version: 'v25.0',
        features: ['whatsapp_business_app_onboarding'],
      };

      return sendSuccess(res, config, 'Config fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // GET INTEGRATION STATUS
  // ============================================
  async getIntegrationStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const status = {
        configured: !!(process.env.META_APP_ID && process.env.META_APP_SECRET),
        appId: process.env.META_APP_ID,
        version: 'v25.0',
        embeddedSignup: true,
      };

      return sendSuccess(res, status, 'Integration status fetched');
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // WEBHOOK VERIFICATION (META REQUIREMENT)
  // ============================================
  async verifyWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
        console.log('✅ Webhook verified');
        res.status(200).send(challenge);
      } else {
        console.error('❌ Webhook verification failed');
        res.sendStatus(403);
      }
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // WEBHOOK HANDLER
  // ============================================
  async handleWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      console.log('📨 Webhook received:', JSON.stringify(req.body, null, 2));

      // TODO: Process webhook events (message status updates, etc.)

      res.sendStatus(200);
    } catch (error) {
      console.error('❌ Webhook error:', error);
      res.sendStatus(500);
    }
  }
}

export const metaController = new MetaController();
export default metaController;