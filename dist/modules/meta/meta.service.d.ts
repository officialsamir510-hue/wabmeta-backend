import { ConnectionProgress } from './meta.types';
declare class MetaService {
    /**
     * Generate OAuth URL for Meta login
     */
    getOAuthUrl(state: string): string;
    /**
     * Get Embedded Signup configuration
     */
    getEmbeddedSignupConfig(): {
        appId: string;
        configId: string;
        version: string;
        features: string[];
    };
    /**
     * Complete Meta connection flow
     */
    completeConnection(code: string, organizationId: string, userId: string, onProgress?: (progress: ConnectionProgress) => void): Promise<{
        success: boolean;
        account?: any;
        error?: string;
    }>;
    /**
     * Get accounts for organization
     */
    getAccounts(organizationId: string): Promise<any[]>;
    /**
     * Get single account
     */
    getAccount(accountId: string, organizationId: string): Promise<any>;
    /**
     * Get account with decrypted token (internal use)
     */
    getAccountWithToken(accountId: string): Promise<{
        account: any;
        accessToken: string;
    } | null>;
    /**
     * Disconnect account
     */
    disconnectAccount(accountId: string, organizationId: string): Promise<{
        success: boolean;
    }>;
    /**
     * Set default account
     */
    setDefaultAccount(accountId: string, organizationId: string): Promise<{
        success: boolean;
    }>;
    /**
     * Refresh account health/status
     */
    refreshAccountHealth(accountId: string, organizationId: string): Promise<{
        healthy: boolean;
        qualityRating: string;
        verifiedName: string;
        reason?: undefined;
    } | {
        healthy: boolean;
        reason: any;
        qualityRating?: undefined;
        verifiedName?: undefined;
    }>;
    /**
     * Sync templates from Meta
     */
    syncTemplates(accountId: string, organizationId: string): Promise<{
        synced: number;
    }>;
    /**
     * Background template sync
     */
    private syncTemplatesBackground;
    /**
     * Remove sensitive data from account
     */
    private sanitizeAccount;
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