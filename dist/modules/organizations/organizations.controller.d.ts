import { Request, Response, NextFunction } from 'express';
interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        organizationId?: string;
    };
}
export declare class OrganizationsController {
    create(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    getMyOrganizations(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    getById(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    getCurrent(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    update(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    inviteMember(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    updateMemberRole(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    removeMember(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    leave(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    transferOwnership(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    getStats(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    delete(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
}
export declare const organizationsController: OrganizationsController;
export {};
//# sourceMappingURL=organizations.controller.d.ts.map