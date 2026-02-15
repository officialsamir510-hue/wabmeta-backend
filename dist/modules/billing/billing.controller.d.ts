import { Request, Response } from 'express';
declare class BillingController {
    getSubscription(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    getPlans(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    getUsage(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    createRazorpayOrder(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    verifyRazorpayPayment(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    upgradePlan(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    cancelSubscription(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    resumeSubscription(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    getInvoices(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    getInvoice(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
    downloadInvoice(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}
export declare const billingController: BillingController;
export {};
//# sourceMappingURL=billing.controller.d.ts.map