import { Request, Response, NextFunction } from 'express';
interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        organizationId?: string;
    };
}
export declare class InboxController {
    getConversations(req: AuthRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    getConversationById(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    getMessages(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    sendMessage(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    markAsRead(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    archiveConversation(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    unarchiveConversation(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    assignConversation(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    updateConversation(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    addLabels(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    removeLabel(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    deleteConversation(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    bulkUpdate(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    searchMessages(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    getStats(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    getLabels(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
    startConversation(req: AuthRequest, res: Response, next: NextFunction): Promise<any>;
}
export declare const inboxController: InboxController;
export {};
//# sourceMappingURL=inbox.controller.d.ts.map