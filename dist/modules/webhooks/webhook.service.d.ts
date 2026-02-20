import { EventEmitter } from 'events';
export declare const webhookEvents: EventEmitter<any>;
declare class WebhookService {
    verifyWebhook(mode: string, token: string, challenge: string): string | null;
    processWebhook(payload: any, signature: string | undefined): Promise<{
        success: boolean;
        processed: number;
    }>;
    private processIncomingMessage;
    private processMessageStatus;
    private updateCampaignContactStatus;
    expireConversationWindows(): Promise<number>;
    resetDailyMessageLimits(): Promise<number>;
    private updateWebhookLog;
    private mapMessageType;
    private mapStatus;
    private getMessagePreview;
    private extractMessageContent;
    private getMediaUrl;
}
export declare const webhookService: WebhookService;
export default webhookService;
//# sourceMappingURL=webhook.service.d.ts.map