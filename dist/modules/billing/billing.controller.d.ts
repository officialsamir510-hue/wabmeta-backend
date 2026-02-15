import { Request, Response } from 'express';
declare class BillingController {
    getSubscription(req: Request, res: Response): Promise<any>;
    getPlans(req: Request, res: Response): Promise<any>;
    getUsage(req: Request, res: Response): Promise<any>;
    createRazorpayOrder(req: Request, res: Response): Promise<any>;
    verifyRazorpayPayment(req: Request, res: Response): Promise<any>;
    upgradePlan(req: Request, res: Response): Promise<any>;
    cancelSubscription(req: Request, res: Response): Promise<any>;
    resumeSubscription(req: Request, res: Response): Promise<any>;
    getInvoices(req: Request, res: Response): Promise<any>;
    getInvoice(req: Request, res: Response): Promise<any>;
    downloadInvoice(req: Request, res: Response): Promise<Response<any, Record<string, any>>>;
}
export declare const billingController: BillingController;
export {};
//# sourceMappingURL=billing.controller.d.ts.map