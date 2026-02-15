import { Request, Response, NextFunction } from 'express';
declare class MetaController {
    /**
     * Get embedded signup configuration
     */
    getEmbeddedConfig(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Get Meta integration status
     */
    getStatus(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Generate OAuth URL for Meta login
     */
    getOAuthUrl(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Handle OAuth callback
     */
    handleCallback(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Get organization connection status - FIXED VERSION
     */
    getOrganizationStatus(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Get all WhatsApp accounts for organization
     */
    getAccounts(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Get single WhatsApp account
     */
    getAccount(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Disconnect WhatsApp account
     */
    disconnectAccount(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Set account as default
     */
    setDefaultAccount(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Refresh account health status
     */
    refreshHealth(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Sync templates from Meta
     */
    syncTemplates(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Debug token encryption/decryption for an account
     * @route   GET /api/meta/debug-token/:accountId
     * @desc    Debug token encryption/decryption issues
     * @access  Private - Only accessible to organization members
     */
    debugToken(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>>>;
    /**
     * Debug all accounts for an organization
     * @route   GET /api/meta/debug-all/:organizationId
     * @desc    Debug all accounts' token status
     * @access  Private
     */
    debugAllTokens(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>>>;
    /**
     * Reset all Meta connections for organization
     * ⚠️ DANGEROUS: This will delete all WhatsApp accounts and connections
     * Use only for development/debugging
     */
    resetAccount(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>>>;
    /**
     * Force disconnect all accounts for organization (Soft Delete)
     * This only disconnects accounts without deleting data
     */
    forceDisconnectAll(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>>>;
    /**
     * Verify user has access to organization
     */
    private verifyOrgAccess;
}
export declare const metaController: MetaController;
export default metaController;
//# sourceMappingURL=meta.controller.d.ts.map