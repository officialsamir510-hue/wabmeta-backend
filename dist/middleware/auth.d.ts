import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/express';
export declare const authenticate: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const requireEmailVerified: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const requireOrganization: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const optionalAuth: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=auth.d.ts.map