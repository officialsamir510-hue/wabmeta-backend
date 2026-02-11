import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../types/express';
export interface AdminRequest extends AuthRequest {
    admin?: {
        id: string;
        email: string;
        role: string;
    };
}
export declare const authenticateAdmin: (req: AdminRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const requireSuperAdmin: (req: AdminRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const generateAdminToken: (admin: {
    id: string;
    email: string;
    role: string;
}) => string;
//# sourceMappingURL=admin.middleware.d.ts.map