import { CurrentPlanResponse, UsageStatsResponse, InvoiceResponse, PaymentMethodResponse, AvailablePlanResponse, UpgradePlanInput } from './billing.types';
export declare class BillingService {
    getCurrentPlan(organizationId: string): Promise<CurrentPlanResponse>;
    getUsageStats(organizationId: string): Promise<UsageStatsResponse>;
    getAvailablePlans(organizationId: string): Promise<AvailablePlanResponse[]>;
    upgradePlan(organizationId: string, userId: string, input: UpgradePlanInput): Promise<{
        message: string;
        subscription: any;
    }>;
    cancelSubscription(organizationId: string, userId: string): Promise<{
        message: string;
    }>;
    getInvoices(organizationId: string, page?: number, limit?: number): Promise<{
        invoices: InvoiceResponse[];
        total: number;
    }>;
    getPaymentMethods(_organizationId: string): Promise<PaymentMethodResponse[]>;
    addPaymentMethod(_organizationId: string, input: any): Promise<PaymentMethodResponse>;
    deletePaymentMethod(_organizationId: string, _paymentMethodId: string): Promise<{
        message: string;
    }>;
    setDefaultPaymentMethod(_organizationId: string, _paymentMethodId: string): Promise<{
        message: string;
    }>;
}
export declare const billingService: BillingService;
//# sourceMappingURL=billing.service.d.ts.map