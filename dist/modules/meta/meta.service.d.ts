import { WhatsAppAccount } from '@prisma/client';
import { ConnectionProgress } from './meta.types';
declare class MetaService {
    /**
     * Check if a string looks like a Meta access token
     */
    private looksLikeAccessToken;
    /**
     * Remove sensitive data from account object
     */
    private sanitizeAccount;
    /**
     * Generate OAuth URL for Meta Embedded Signup
     */
    getOAuthUrl(state: string): string;
    /**
     * Get Embedded Signup configuration for frontend
     */
    getEmbeddedSignupConfig(): {
        appId: string;
        configId: string;
        version: string;
        redirectUri: string;
        features: string[];
    };
    /**
     * Get Integration Status
     */
    getIntegrationStatus(): {
        configured: boolean;
        appId: string | null;
        hasConfigId: boolean;
        hasRedirectUri: boolean;
        apiVersion: string;
    };
    /**
     * Complete Meta connection flow
     */
    completeConnection(codeOrToken: string, organizationId: string, userId: string, onProgress?: (progress: ConnectionProgress) => void): Promise<{
        success: boolean;
        account?: any;
        error?: string;
    }>;
    /**
     * Get all accounts for organization
     */
    getAccounts(organizationId: string): Promise<any[]>;
    /**
     * Get single account by ID
     */
    getAccount(accountId: string, organizationId: string): Promise<any>;
    /**
     * Get account with decrypted token (internal use only) - ✅ FIXED
     */
    getAccountWithToken(accountId: string): Promise<{
        account: WhatsAppAccount;
        accessToken: string;
    } | null>;
    /**
     * Update account access token
     */
    updateAccountToken(accountId: string, newToken: string): Promise<void>;
    /**
     * Disconnect WhatsApp account
     */
    disconnectAccount(accountId: string, organizationId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Set account as default
     */
    setDefaultAccount(accountId: string, organizationId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Refresh account health/status from Meta
     */
    refreshAccountHealth(accountId: string, organizationId: string): Promise<{
        healthy: boolean;
        qualityRating: string;
        verifiedName: string;
        displayPhoneNumber: string;
        status: any;
        reason?: undefined;
        action?: undefined;
    } | {
        healthy: boolean;
        reason: any;
        action: string;
        qualityRating?: undefined;
        verifiedName?: undefined;
        displayPhoneNumber?: undefined;
        status?: undefined;
    }>;
    syncTemplates(accountId: string, organizationId: string): Promise<{
        synced: number;
        created: number;
        updated: number;
        skipped: number;
        removed: number;
        total: number;
    }>;
    private extractVariables;
    private syncTemplatesBackground;
    private mapCategory;
    private mapTemplateStatus;
    private extractBodyText;
    private extractHeaderType;
    private extractHeaderContent;
    private extractFooterText;
    private extractButtons;
}
export declare const metaService: MetaService;
export default metaService;
//# sourceMappingURL=meta.service.d.ts.map