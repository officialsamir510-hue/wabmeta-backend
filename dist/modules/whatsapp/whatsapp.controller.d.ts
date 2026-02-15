import { Request, Response, NextFunction } from 'express';
declare class WhatsAppController {
    getAccounts(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    getAccount(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    setDefaultAccount(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    disconnectAccount(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    sendText(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    sendTemplate(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    sendMedia(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
    markAsRead(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
}
export declare const whatsappController: WhatsAppController;
export default whatsappController;
//# sourceMappingURL=whatsapp.controller.d.ts.map