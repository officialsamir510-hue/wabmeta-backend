import { Request, Response, NextFunction } from 'express';
declare class WhatsAppController {
    /**
     * Send text message
     */
    sendText(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Send template message
     */
    sendTemplate(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Send media message
     */
    sendMedia(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Mark message as read
     */
    markAsRead(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
}
export declare const whatsappController: WhatsAppController;
export default whatsappController;
//# sourceMappingURL=whatsapp.controller.d.ts.map