import { Request, Response, NextFunction } from 'express';
interface RateLimitOptions {
    windowMs?: number;
    max?: number;
    message?: string;
}
export declare const rateLimit: (options?: RateLimitOptions) => (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export declare const authRateLimit: (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export {};
//# sourceMappingURL=rateLimit.d.ts.map