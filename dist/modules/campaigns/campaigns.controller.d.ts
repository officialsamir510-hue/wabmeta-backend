import { Request, Response, NextFunction } from 'express';
interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        organizationId?: string;
    };
}
export declare class CampaignsController {
    create(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    getList(req: AuthRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    getById(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    update(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    delete(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    start(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    pause(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    resume(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    cancel(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    getContacts(req: AuthRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    retry(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    duplicate(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    getStats(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    getAnalytics(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
}
export declare const campaignsController: CampaignsController;
export {};
//# sourceMappingURL=campaigns.controller.d.ts.map