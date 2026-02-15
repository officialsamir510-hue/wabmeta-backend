// src/modules/meta/meta.controller.ts

import { Request, Response, NextFunction } from 'express';
import { metaService } from './meta.service';
import { successResponse, errorResponse } from '../../utils/response';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient, WhatsAppAccountStatus } from '@prisma/client';
import { isMetaToken, maskToken, safeDecryptStrict } from '../../utils/encryption';

const prisma = new PrismaClient();

// Helper function to safely get string from params/query
const getString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return '';
};

class MetaController {
  /**
   * Get embedded signup configuration
   */
  async getEmbeddedConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const cfg = metaService.getEmbeddedSignupConfig();
      return successResponse(res, {
        data: cfg,
        message: 'Embedded signup config retrieved'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Meta integration status
   */
  async getStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const status = metaService.getIntegrationStatus();
      return successResponse(res, {
        data: status,
        message: 'Meta integration status'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate OAuth URL for Meta login
   */
  async getOAuthUrl(req: Request, res: Response, next: NextFunction) {
    try {
      const orgFromQuery = getString(req.query.organizationId);
      const orgFromUser = (req.user as any)?.organizationId;
      const organizationId = orgFromQuery || orgFromUser;

      if (!organizationId) {
        return errorResponse(res, 'Organization ID required', 400);
      }

      // Create state (base64 JSON)
      const state = Buffer.from(
        JSON.stringify({
          organizationId,
          userId: req.user!.id,
          nonce: uuidv4(),
          timestamp: Date.now(),
        })
      ).toString('base64');

      const url = metaService.getOAuthUrl(state);

      return successResponse(res, {
        data: { url, state },
        message: 'OAuth URL generated',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handle OAuth callback
   */
  async handleCallback(req: Request, res: Response, next: NextFunction) {
    try {
      const { code, organizationId } = req.body;

      if (!code || !organizationId) {
        return errorResponse(res, 'Code and organization ID are required', 400);
      }

      const hasAccess = await this.verifyOrgAccess(req.user!.id, String(organizationId));
      if (!hasAccess) {
        return errorResponse(res, 'You do not have access to this organization', 403);
      }

      const result = await metaService.completeConnection(
        String(code),
        String(organizationId),
        req.user!.id
      );

      if (!result.success) {
        return errorResponse(res, result.error || 'Connection failed', 400);
      }

      return successResponse(res, {
        data: { account: result.account },
        message: 'WhatsApp account connected successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get organization connection status - FIXED VERSION
   */
  async getOrganizationStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = getString(req.params.organizationId);

      const hasAccess = await this.verifyOrgAccess(req.user!.id, organizationId);
      if (!hasAccess) {
        return errorResponse(res, 'Unauthorized', 403);
      }

      // Get all accounts for the organization
      const accounts = await metaService.getAccounts(organizationId);

      // Filter only accounts with CONNECTED status
      const connectedAccounts = accounts.filter((account: any) =>
        account.status === WhatsAppAccountStatus.CONNECTED
      );

      return successResponse(res, {
        data: {
          status: connectedAccounts.length > 0 ? 'CONNECTED' : 'DISCONNECTED',
          connectedCount: connectedAccounts.length,
          totalAccounts: accounts.length,
          accounts: accounts.map(acc => ({
            id: acc.id,
            phoneNumber: acc.phoneNumber,
            displayName: acc.displayName,
            status: acc.status,
            isDefault: acc.isDefault,
            qualityRating: acc.qualityRating,
          }))
        },
        message: 'Organization Meta connection status',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all WhatsApp accounts for organization
   */
  async getAccounts(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = getString(req.params.organizationId);

      const hasAccess = await this.verifyOrgAccess(req.user!.id, organizationId);
      if (!hasAccess) return errorResponse(res, 'Unauthorized', 403);

      const accounts = await metaService.getAccounts(organizationId);

      return successResponse(res, {
        data: { accounts },
        message: 'Accounts retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single WhatsApp account
   */
  async getAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = getString(req.params.organizationId);
      const accountId = getString(req.params.accountId);

      const hasAccess = await this.verifyOrgAccess(req.user!.id, organizationId);
      if (!hasAccess) return errorResponse(res, 'Unauthorized', 403);

      const account = await metaService.getAccount(accountId, organizationId);

      return successResponse(res, {
        data: { account },
        message: 'Account retrieved successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Disconnect WhatsApp account
   */
  async disconnectAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = getString(req.params.organizationId);
      const accountId = getString(req.params.accountId);

      const hasAccess = await this.verifyOrgAccess(req.user!.id, organizationId);
      if (!hasAccess) return errorResponse(res, 'Unauthorized', 403);

      const result = await metaService.disconnectAccount(accountId, organizationId);

      return successResponse(res, {
        data: result,
        message: 'Account disconnected successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Set account as default
   */
  async setDefaultAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = getString(req.params.organizationId);
      const accountId = getString(req.params.accountId);

      const hasAccess = await this.verifyOrgAccess(req.user!.id, organizationId);
      if (!hasAccess) return errorResponse(res, 'Unauthorized', 403);

      const result = await metaService.setDefaultAccount(accountId, organizationId);

      return successResponse(res, {
        data: result,
        message: 'Default account updated'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Refresh account health status
   */
  async refreshHealth(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = getString(req.params.organizationId);
      const accountId = getString(req.params.accountId);

      const hasAccess = await this.verifyOrgAccess(req.user!.id, organizationId);
      if (!hasAccess) return errorResponse(res, 'Unauthorized', 403);

      const health = await metaService.refreshAccountHealth(accountId, organizationId);

      return successResponse(res, {
        data: health,
        message: 'Health check completed',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Sync templates from Meta
   */
  async syncTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = getString(req.params.organizationId);
      const accountId = getString(req.params.accountId);

      const hasAccess = await this.verifyOrgAccess(req.user!.id, organizationId);
      if (!hasAccess) return errorResponse(res, 'Unauthorized', 403);

      const result = await metaService.syncTemplates(accountId, organizationId);

      return successResponse(res, {
        data: result,
        message: 'Templates synced successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Debug token encryption/decryption for an account
   * @route   GET /api/meta/debug-token/:accountId
   * @desc    Debug token encryption/decryption issues
   * @access  Private - Only accessible to organization members
   */
  async debugToken(req: Request, res: Response, next: NextFunction) {
    try {
      const accountId = getString(req.params.accountId);

      // First, get the account to check organization
      const account = await prisma.whatsAppAccount.findUnique({
        where: { id: accountId },
      });

      if (!account) {
        return errorResponse(res, 'Account not found', 404);
      }

      // Verify user has access to this organization
      const hasAccess = await this.verifyOrgAccess(req.user!.id, account.organizationId);
      if (!hasAccess) {
        return errorResponse(res, 'Unauthorized', 403);
      }

      console.log('\n🔍 ========== TOKEN DEBUG START ==========');
      console.log('   Account ID:', accountId);
      console.log('   Organization ID:', account.organizationId);
      console.log('   User ID:', req.user!.id);

      // Try to get decrypted token
      const result = await metaService.getAccountWithToken(accountId);

      // Prepare debug info
      const debugInfo = {
        account: {
          id: account.id,
          organizationId: account.organizationId,
          phoneNumber: account.phoneNumber,
          displayName: account.displayName,
          status: account.status,
          isDefault: account.isDefault,
          qualityRating: account.qualityRating,
          createdAt: account.createdAt,
          updatedAt: account.updatedAt,
        },
        tokenStorage: {
          hasStoredToken: !!account.accessToken,
          storedTokenLength: account.accessToken?.length || 0,
          storedTokenPreview: account.accessToken ?
            `${account.accessToken.substring(0, 30)}...${account.accessToken.substring(account.accessToken.length - 10)}` :
            null,
          tokenExpiresAt: account.tokenExpiresAt,
          isExpired: account.tokenExpiresAt ? account.tokenExpiresAt < new Date() : null,
          expiresInDays: account.tokenExpiresAt ?
            Math.floor((account.tokenExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) :
            null,
        },
        decryption: {
          canDecrypt: !!result,
          decryptedSuccessfully: !!result?.accessToken,
          decryptedTokenValid: result ? isMetaToken(result.accessToken) : false,
          decryptedTokenPreview: result ? maskToken(result.accessToken) : null,
        },
        validation: {
          isValidFormat: result ? result.accessToken.startsWith('EAA') : false,
          tokenLength: result ? result.accessToken.length : 0,
          containsSpecialChars: result ? /[^A-Za-z0-9_-]/.test(result.accessToken) : null,
          directDecryptWorks: undefined as boolean | undefined,
          directDecryptValid: undefined as boolean | undefined,
          directDecryptError: undefined as string | undefined,
        },
        recommendations: [] as string[],
      };

      // Add recommendations based on findings
      if (!account.accessToken) {
        debugInfo.recommendations.push('No token stored. Reconnect the WhatsApp account.');
      } else if (!result) {
        debugInfo.recommendations.push('Token exists but cannot decrypt. Possible encryption key mismatch.');
        debugInfo.recommendations.push('Check ENCRYPTION_KEY in .env file.');
        debugInfo.recommendations.push('Reconnect the WhatsApp account to fix.');
      } else if (!isMetaToken(result.accessToken)) {
        debugInfo.recommendations.push('Decrypted value is not a valid Meta token.');
        debugInfo.recommendations.push('Token may be corrupted. Reconnect the account.');
      } else if (debugInfo.tokenStorage.isExpired) {
        debugInfo.recommendations.push('Token has expired. Reconnect to refresh.');
      } else {
        debugInfo.recommendations.push('Token appears valid and working correctly.');
      }

      // Test direct decryption (for extra debugging)
      if (account.accessToken && process.env.NODE_ENV !== 'production') {
        try {
          const directDecrypt = safeDecryptStrict(account.accessToken);
          debugInfo.validation = {
            ...debugInfo.validation,
            directDecryptWorks: !!directDecrypt,
            directDecryptValid: directDecrypt ? isMetaToken(directDecrypt) : false,
          };
        } catch (err) {
          debugInfo.validation = {
            ...debugInfo.validation,
            directDecryptWorks: false,
            directDecryptError: (err as Error).message,
          };
        }
      }

      console.log('🔍 Debug info compiled:', JSON.stringify(debugInfo, null, 2));
      console.log('🔍 ========== TOKEN DEBUG END ==========\n');

      return successResponse(res, {
        data: debugInfo,
        message: 'Token debug information retrieved',
      });

    } catch (error: any) {
      console.error('❌ Token debug error:', error);
      return errorResponse(res, `Debug failed: ${error.message}`, 500);
    }
  }

  /**
   * Debug all accounts for an organization
   * @route   GET /api/meta/debug-all/:organizationId
   * @desc    Debug all accounts' token status
   * @access  Private
   */
  async debugAllTokens(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = getString(req.params.organizationId);

      const hasAccess = await this.verifyOrgAccess(req.user!.id, organizationId);
      if (!hasAccess) {
        return errorResponse(res, 'Unauthorized', 403);
      }

      const accounts = await prisma.whatsAppAccount.findMany({
        where: { organizationId },
      });

      const debugResults = await Promise.all(
        accounts.map(async (account) => {
          const result = await metaService.getAccountWithToken(account.id);
          return {
            accountId: account.id,
            phoneNumber: account.phoneNumber,
            status: account.status,
            hasToken: !!account.accessToken,
            canDecrypt: !!result,
            tokenValid: result ? isMetaToken(result.accessToken) : false,
            tokenExpired: account.tokenExpiresAt ? account.tokenExpiresAt < new Date() : null,
          };
        })
      );

      const summary = {
        totalAccounts: debugResults.length,
        connected: debugResults.filter(r => r.status === WhatsAppAccountStatus.CONNECTED).length,
        withTokens: debugResults.filter(r => r.hasToken).length,
        canDecrypt: debugResults.filter(r => r.canDecrypt).length,
        validTokens: debugResults.filter(r => r.tokenValid).length,
        expiredTokens: debugResults.filter(r => r.tokenExpired).length,
      };

      return successResponse(res, {
        data: {
          summary,
          accounts: debugResults,
        },
        message: 'Organization token debug complete',
      });

    } catch (error: any) {
      console.error('❌ Debug all tokens error:', error);
      return errorResponse(res, error.message, 500);
    }
  }

  /**
   * Reset all Meta connections for organization
   * ⚠️ DANGEROUS: This will delete all WhatsApp accounts and connections
   * Use only for development/debugging
   */
  async resetAccount(req: Request, res: Response, next: NextFunction) {
    try {
      // Get organization ID from query or user
      const orgFromQuery = getString(req.query.organizationId);
      const orgFromUser = (req.user as any)?.organizationId;
      const organizationId = orgFromQuery || orgFromUser;

      if (!organizationId) {
        return errorResponse(res, 'Organization ID required', 400);
      }

      // Verify user has access to this organization
      const hasAccess = await this.verifyOrgAccess(req.user!.id, organizationId);
      if (!hasAccess) {
        return errorResponse(res, 'You do not have access to this organization', 403);
      }

      console.log(`⚠️ RESET REQUEST for organization: ${organizationId}`);

      // Start transaction to ensure data consistency
      const result = await prisma.$transaction(async (tx) => {
        // 1. Get all WhatsApp accounts for this organization
        const accounts = await tx.whatsAppAccount.findMany({
          where: { organizationId },
          select: { id: true, phoneNumber: true }
        });

        console.log(`Found ${accounts.length} WhatsApp accounts to delete`);

        // 2. Delete all WhatsApp accounts
        const deletedAccounts = await tx.whatsAppAccount.deleteMany({
          where: { organizationId }
        });

        // 3. Delete all templates for this organization
        const deletedTemplates = await tx.template.deleteMany({
          where: { organizationId }
        });

        // 4. Delete all campaigns for this organization
        const deletedCampaigns = await tx.campaign.deleteMany({
          where: { organizationId }
        });

        // 5. Delete all messages for this organization
        const deletedMessages = await tx.message.deleteMany({
          where: {
            conversation: {
              organizationId
            }
          }
        });

        // 6. Delete all contacts for this organization (if needed)
        const deletedContacts = await tx.contact.deleteMany({
          where: { organizationId }
        });

        return {
          deletedAccounts: deletedAccounts.count,
          deletedTemplates: deletedTemplates.count,
          deletedCampaigns: deletedCampaigns.count,
          deletedMessages: deletedMessages.count,
          deletedContacts: deletedContacts.count,
          accountDetails: accounts
        };
      });

      console.log('✅ Reset completed:', result);

      return successResponse(res, {
        data: {
          success: true,
          deleted: {
            accounts: result.deletedAccounts,
            templates: result.deletedTemplates,
            campaigns: result.deletedCampaigns,
            messages: result.deletedMessages,
            contacts: result.deletedContacts
          },
          accountDetails: result.accountDetails
        },
        message: 'All Meta connections and related data have been reset successfully'
      });

    } catch (error: any) {
      console.error('❌ Reset account error:', error);
      return errorResponse(res, `Reset failed: ${error.message}`, 500);
    }
  }

  /**
   * Force disconnect all accounts for organization (Soft Delete)
   * This only disconnects accounts without deleting data
   */
  async forceDisconnectAll(req: Request, res: Response, next: NextFunction) {
    try {
      const orgFromQuery = getString(req.query.organizationId);
      const orgFromUser = (req.user as any)?.organizationId;
      const organizationId = orgFromQuery || orgFromUser;

      if (!organizationId) {
        return errorResponse(res, 'Organization ID required', 400);
      }

      const hasAccess = await this.verifyOrgAccess(req.user!.id, organizationId);
      if (!hasAccess) {
        return errorResponse(res, 'Unauthorized', 403);
      }

      // Update all accounts to DISCONNECTED status
      const result = await prisma.whatsAppAccount.updateMany({
        where: {
          organizationId,
          status: WhatsAppAccountStatus.CONNECTED
        },
        data: {
          status: WhatsAppAccountStatus.DISCONNECTED,
          accessToken: null,
          tokenExpiresAt: null
        }
      });

      console.log(`✅ Force disconnected ${result.count} accounts for org ${organizationId}`);

      return successResponse(res, {
        data: {
          disconnectedCount: result.count
        },
        message: `Successfully disconnected ${result.count} account(s)`
      });

    } catch (error: any) {
      console.error('❌ Force disconnect error:', error);
      return errorResponse(res, error.message, 500);
    }
  }

  /**
   * Verify user has access to organization
   */
  private async verifyOrgAccess(userId: string, organizationId: string): Promise<boolean> {
    try {
      const member = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId
          },
        },
      });
      return !!member;
    } catch (error) {
      console.error('Error verifying org access:', error);
      return false;
    }
  }
}

export const metaController = new MetaController();
export default metaController;