import { Request, Response, NextFunction } from 'express';
interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        organizationId?: string;
    };
    cookies: {
        refreshToken?: string;
    };
}
export declare class UsersController {
    getProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    getProfileWithOrganizations(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    updateProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    updateAvatar(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    getStats(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    getSessions(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    revokeSession(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    revokeAllSessions(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    deleteAccount(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
}
export declare const usersController: UsersController;
export {};
//# sourceMappingURL=users.controller.d.ts.map