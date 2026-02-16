import { WhatsAppAccount } from '@prisma/client';
import { ConnectionProgress } from './meta.types';
declare class MetaService {
    private sanitizeAccount;
    getOAuthUrl(state: string): string;
    getEmbeddedSignupConfig(): {
        appId: string;
        configId: string;
        version: string;
        redirectUri: string;
        features: string[];
    };
    getIntegrationStatus(): {
        configured: boolean;
        appId: string | null;
        hasConfigId: boolean;
        hasRedirectUri: boolean;
        apiVersion: string;
    };
    completeConnection(codeOrToken: string, organizationId: string, userId: string, onProgress?: (progress: ConnectionProgress) => void): Promise<{
        success: boolean;
        account?: any;
        error?: string;
    }>;
    getAccounts(organizationId: string): Promise<any[]>;
    getAccount(accountId: string, organizationId: string): Promise<any>;
    getAccountWithToken(accountId: string): Promise<{
        account: WhatsAppAccount;
        accessToken: string;
    } | null>;
    disconnectAccount(accountId: string, organizationId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    setDefaultAccount(accountId: string, organizationId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    syncTemplates(accountId: string, organizationId: string): Promise<{
        created: number;
        updated: number;
        removed: number;
        skipped: number;
        total: number;
    }>;
    private syncTemplatesBackground;
    private mapCategory;
    private mapTemplateStatus;
    private extractBodyText;
    private extractHeaderType;
    private extractHeaderContent;
    private extractFooterText;
    private extractButtons;
    private extractVariables;
}
export declare const metaService: MetaService;
export default metaService;
//# sourceMappingURL=meta.service.d.ts.map