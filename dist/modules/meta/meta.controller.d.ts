import { Request, Response, NextFunction } from 'express';
declare class MetaController {
    /**
     * Get Embedded Signup config
     */
    getEmbeddedConfig(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Get Integration Status
     */
    getStatus(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Generate OAuth URL (alternative flow)
     */
    getOAuthUrl(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Handle OAuth callback / Complete connection
     */
    handleCallback(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Get all WhatsApp accounts for organization
     */
    getAccounts(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Get single account
     */
    getAccount(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Disconnect account
     */
    disconnectAccount(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Set default account
     */
    setDefaultAccount(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Refresh account health
     */
    refreshHealth(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Sync templates
     */
    syncTemplates(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    private verifyOrgAccess;
}
export declare const metaController: MetaController;
export default metaController;
//# sourceMappingURL=meta.controller.d.ts.map