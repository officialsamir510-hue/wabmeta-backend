export declare class WebhookService {
    /**
     * Extract WhatsApp profile data from webhook payload
     */
    private extractProfile;
    /**
     * Validate if number is Indian
     */
    private isIndianNumber;
    /**
     * Extract message data from webhook
     */
    private extractMessageData;
    /**
     * Handle incoming WhatsApp webhook
     */
    handleWebhook(payload: any): Promise<{
        status: string;
        reason?: string;
        profileName?: string;
        error?: string;
    }>;
    /**
     * Process incoming message
     */
    private processIncomingMessage;
    /**
     * Process status update
     */
    private processStatusUpdate;
    /**
     * Verify webhook (for Meta setup)
     */
    verifyWebhook(mode: string, token: string, challenge: string): string | null;
    /**
     * Log webhook for debugging
     */
    logWebhook(payload: any, status: string, error?: string): Promise<void>;
}
export declare const webhookService: WebhookService;
//# sourceMappingURL=webhook.service.d.ts.map