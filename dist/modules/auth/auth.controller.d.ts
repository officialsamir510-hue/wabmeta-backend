import { Request, Response, NextFunction } from 'express';
interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        organizationId?: string;
    };
}
export declare class AuthController {
    register(req: Request, res: Response, next: NextFunction): Promise<any>;
    login(req: Request, res: Response, next: NextFunction): Promise<any>;
    verifyEmail(req: Request, res: Response, next: NextFunction): Promise<any>;
    resendVerification(req: Request, res: Response, next: NextFunction): Promise<any>;
    forgotPassword(req: Request, res: Response, next: NextFunction): Promise<any>;
    resetPassword(req: Request, res: Response, next: NextFunction): Promise<any>;
    sendOTP(req: Request, res: Response, next: NextFunction): Promise<any>;
    verifyOTP(req: Request, res: Response, next: NextFunction): Promise<any>;
    googleAuth(req: Request, res: Response, next: NextFunction): Promise<any>;
    refreshToken(req: Request, res: Response, next: NextFunction): Promise<any>;
    logout(req: Request, res: Response, next: NextFunction): Promise<any>;
    logoutAll(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    me(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    changePassword(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
}
export declare const authController: AuthController;
export {};
//# sourceMappingURL=auth.controller.d.ts.map