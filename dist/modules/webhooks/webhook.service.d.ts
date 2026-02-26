import { EventEmitter } from 'events';
export declare const webhookEvents: EventEmitter<any>;
export declare class WebhookService {
    private extractValue;
    private extractProfile;
    private isIndianNumber;
    private mapMessageType;
    private buildContentAndMedia;
    private findOrCreateContact;
    handleWebhook(payload: any): Promise<{
        status: string;
        reason?: string;
        profileName?: string;
        error?: string;
    }>;
    private processIncomingMessage;
    private processStatusUpdate;
    private updateCampaignContactStatus;
    verifyWebhook(mode: string, token: string, challenge: string): string | null;
    logWebhook(payload: any, status: string, error?: string): Promise<void>;
    expireConversationWindows(): Promise<void>;
    resetDailyMessageLimits(): Promise<void>;
}
export declare const webhookService: WebhookService;
export default webhookService;
//# sourceMappingURL=webhook.service.d.ts.map