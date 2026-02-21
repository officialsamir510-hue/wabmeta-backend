// 📁 src/modules/meta/meta.controller.ts - COMPLETE FIXED VERSION WITH EMBEDDED SIGNUP v3

import { Request, Response, NextFunction } from 'express';
import { metaService } from './meta.service';
import { AppError } from '../../middleware/errorHandler';
import { sendSuccess } from '../../utils/response';
import prisma from '../../config/database';
import { generateToken } from '../../utils/otp';
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
  // INITIATE CONNECTION (NEW - Embedded Signup v3)
  // ============================================
  async initiateConnection(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { organizationId } = req.body;
      const userId = req.user?.id;

      if (!organizationId) {
        throw new AppError('Organization ID is required', 400);
      }

      if (!userId) {
        throw new AppError('Authentication required', 401);
      }

      // Verify user permissions
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

      // Generate secure state
      const state = `${organizationId}:${crypto.randomBytes(32).toString('hex')}`;

      // Save state to database
      await (prisma as any).oAuthState.create({
        data: {
          state,
          organizationId,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min
        },
      });

      // Clean up expired states
      await (prisma as any).oAuthState.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });

      // Meta Embedded Signup URL (v25)
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
      metaAuthUrl.searchParams.set('scope', 'whatsapp_business_management,whatsapp_business_messaging,business_management');

      console.log('📱 Meta Embedded Signup URL generated for organization:', organizationId);

      return sendSuccess(res, {
        authUrl: metaAuthUrl.toString(),
        state
      }, 'OAuth URL generated');
    } catch (error) {
      console.error('Meta connection initiation failed:', error);
      next(error);
    }
  }

  // ============================================
  // GET OAUTH URL (Legacy support)
  // ============================================
  async getOAuthUrl(req: AuthRequest, res: Response, next: NextFunction) {
    return this.initiateConnection(req, res, next);
  }

  async getAuthUrl(req: AuthRequest, res: Response, next: NextFunction) {
    return this.initiateConnection(req, res, next);
  }

  // ============================================
  // HANDLE CALLBACK (UPDATED for Embedded Signup v3)
  // ============================================
  async handleCallback(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { code, state } = req.body;

      console.log('\n🔄 ========== META CALLBACK (Embedded Signup v3) ==========');
      console.log('   Code received:', code ? 'Yes' : 'No');
      console.log('   State received:', state ? 'Yes' : 'No');

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
        throw new AppError('Invalid state token', 400);
      }

      if (oauthState.expiresAt < new Date()) {
        await (prisma as any).oAuthState.delete({ where: { state } });
        throw new AppError('State token expired. Please try again.', 400);
      }

      const organizationId = oauthState.organizationId;
      console.log('   Organization ID:', organizationId);

      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('Authentication required', 401);
      }

      // Verify permissions
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

      // Get WABA ID from Embedded Signup
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
        throw new AppError('WABA ID not found in token. Please complete the setup in Meta Business Suite.', 400);
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

      console.log('📊 Step 5: Saving to database...');

      // Save to database
      const metaConnection = await (prisma as any).metaConnection.upsert({
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

      // Save phone numbers
      const savedPhoneNumbers = [];
      for (const phone of phoneNumbers) {
        const savedPhone = await (prisma as any).phoneNumber.upsert({
          where: { phoneNumberId: phone.id },
          update: {
            phoneNumber: phone.display_phone_number,
            displayName: phone.verified_name,
            qualityRating: phone.quality_rating,
            verifiedName: phone.verified_name,
          },
          create: {
            metaConnectionId: metaConnection.id,
            phoneNumberId: phone.id,
            phoneNumber: phone.display_phone_number,
            displayName: phone.verified_name,
            qualityRating: phone.quality_rating,
            verifiedName: phone.verified_name,
          },
        });
        savedPhoneNumbers.push(savedPhone);
      }

      // Also create/update WhatsAppAccount for compatibility
      if (phoneNumbers.length > 0) {
        const primaryPhone = phoneNumbers[0];
        await prisma.whatsAppAccount.upsert({
          where: {
            phoneNumberId: primaryPhone.id,
          },
          update: {
            status: 'CONNECTED',
            phoneNumber: primaryPhone.display_phone_number,
            displayName: primaryPhone.verified_name,
            qualityRating: primaryPhone.quality_rating,
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
      }

      console.log('   ✅ Data saved successfully');

      // Delete used state
      await (prisma as any).oAuthState.delete({ where: { state } });

      console.log('✅ Meta callback successful');
      console.log('🔄 ========== META CALLBACK END ==========\n');

      return sendSuccess(res, {
        wabaId,
        wabaName: wabaDetails.data.name,
        phoneNumbers: savedPhoneNumbers.map(p => ({
          id: p.id,
          phoneNumber: p.phoneNumber,
          displayName: p.displayName,
          qualityRating: p.qualityRating,
        })),
        phoneNumberCount: phoneNumbers.length,
      }, 'WhatsApp account connected successfully');
    } catch (error: any) {
      console.error('❌ Meta callback error:', error);

      // Provide more specific error messages
      if (error.response?.data) {
        console.error('   Meta API Error:', error.response.data);
        throw new AppError(
          error.response.data.error?.message || 'Meta API error',
          error.response.status || 500
        );
      }

      next(error);
    }
  }

  // ============================================
  // CONNECT (Legacy support - redirect to handleCallback)
  // ============================================
  async connect(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { code, accessToken, organizationId } = req.body;

      const codeOrToken = accessToken || code;

      if (!codeOrToken) {
        throw new AppError('Authorization code or access token is required', 400);
      }

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
        throw new AppError('You do not have permission to connect WhatsApp', 403);
      }

      const result = await metaService.completeConnection(
        codeOrToken,
        organizationId,
        userId,
        (progress) => {
          console.log(`📊 ${progress.step}: ${progress.message}`);
        }
      );

      if (!result.success) {
        throw new AppError(result.error || 'Failed to connect WhatsApp account', 500);
      }

      return sendSuccess(
        res,
        { account: result.account },
        'WhatsApp account connected successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // GET ACCOUNTS
  // ============================================
  async getAccounts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = getOrgId(req);

      if (!organizationId) {
        throw new AppError('Organization ID is required', 400);
      }

      const accounts = await metaService.getAccounts(organizationId);

      return sendSuccess(res, accounts, 'Accounts fetched');
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // GET ACCOUNT
  // ============================================
  async getAccount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const organizationId = getOrgId(req);

      if (!organizationId) {
        throw new AppError('Organization ID is required', 400);
      }

      const account = await metaService.getAccount(id, organizationId);

      return sendSuccess(res, account, 'Account fetched');
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

      const result = await metaService.disconnectAccount(id, organizationId);

      return sendSuccess(res, result, 'Account disconnected');
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // SET DEFAULT ACCOUNT
  // ============================================
  async setDefaultAccount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const organizationId = getOrgId(req);

      if (!organizationId) {
        throw new AppError('Organization ID is required', 400);
      }

      const result = await metaService.setDefaultAccount(id, organizationId);

      return sendSuccess(res, result, 'Default account updated');
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // SYNC TEMPLATES
  // ============================================
  async syncTemplates(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const organizationId = getOrgId(req);

      if (!organizationId) {
        throw new AppError('Organization ID is required', 400);
      }

      const result = await metaService.syncTemplates(id, organizationId);

      return sendSuccess(res, result, 'Templates synced');
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // GET ORGANIZATION STATUS
  // ============================================
  async getOrganizationStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = Array.isArray(req.params.organizationId)
        ? req.params.organizationId[0]
        : req.params.organizationId;

      if (!organizationId) {
        throw new AppError('Organization ID is required', 400);
      }

      const accounts = await prisma.whatsAppAccount.findMany({
        where: {
          organizationId,
          status: 'CONNECTED',
        },
      });

      const status = accounts.length > 0 ? 'CONNECTED' : 'DISCONNECTED';

      return sendSuccess(res, {
        status,
        connectedCount: accounts.length,
        accounts: accounts.map((a) => ({
          id: a.id,
          phoneNumber: a.phoneNumber,
          displayName: a.displayName,
          isDefault: a.isDefault,
        })),
      });
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // GET CONFIG
  // ============================================
  async getEmbeddedSignupConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const config = metaService.getEmbeddedSignupConfig();

      return sendSuccess(res, config, 'Config fetched');
    } catch (error) {
      next(error);
    }
  }

  async getIntegrationStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const status = metaService.getIntegrationStatus();

      return sendSuccess(res, status, 'Integration status');
    } catch (error) {
      next(error);
    }
  }
}

export const metaController = new MetaController();
export default metaController;