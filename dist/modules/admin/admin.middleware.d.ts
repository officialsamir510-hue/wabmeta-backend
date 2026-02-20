import { Request, Response, NextFunction } from 'express';
interface AdminRequest extends Request {
    admin?: {
        id: string;
        email: string;
        role: string;
        name?: string;
    };
}
export declare const authenticateAdmin: (req: AdminRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const requireSuperAdmin: (req: AdminRequest, res: Response, next: NextFunction) => void;
export declare const requireRole: (...roles: string[]) => (req: AdminRequest, res: Response, next: NextFunction) => void;
export {};
//# sourceMappingURL=admin.middleware.d.ts.map