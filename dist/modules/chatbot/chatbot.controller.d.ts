import { Request, Response, NextFunction } from 'express';
interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        organizationId?: string;
    };
}
export declare class ChatbotController {
    getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    getById(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    create(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    update(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    delete(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    activate(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    deactivate(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    duplicate(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    getStats(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
}
export declare const chatbotController: ChatbotController;
export {};
//# sourceMappingURL=chatbot.controller.d.ts.map