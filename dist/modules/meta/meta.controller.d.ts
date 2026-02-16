import { Request, Response, NextFunction } from 'express';
export declare class MetaController {
    getOAuthUrl(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    getAuthUrl(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    handleCallback(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    connect(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    getAccounts(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    getAccount(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    disconnectAccount(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    setDefaultAccount(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    refreshHealth(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    syncTemplates(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    getOrganizationStatus(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    getEmbeddedSignupConfig(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    getIntegrationStatus(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
}
export declare const metaController: MetaController;
export default metaController;
//# sourceMappingURL=meta.controller.d.ts.map