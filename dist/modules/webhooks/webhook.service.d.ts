import { EventEmitter } from 'events';
export declare const webhookEvents: EventEmitter<any>;
interface WebhookPayload {
    object: string;
    entry: WebhookEntry[];
}
interface WebhookEntry {
    id: string;
    changes: WebhookChange[];
}
interface WebhookChange {
    value: {
        messaging_product: string;
        metadata: {
            display_phone_number: string;
            phone_number_id: string;
        };
        contacts?: Array<{
            profile: {
                name: string;
            };
            wa_id: string;
        }>;
        messages?: WebhookMessage[];
        statuses?: WebhookStatus[];
    };
    field: string;
}
interface WebhookMessage {
    from: string;
    id: string;
    timestamp: string;
    type: string;
    text?: {
        body: string;
    };
    image?: {
        id: string;
        mime_type: string;
        sha256: string;
        caption?: string;
    };
    video?: {
        id: string;
        mime_type: string;
        sha256: string;
        caption?: string;
    };
    audio?: {
        id: string;
        mime_type: string;
        sha256: string;
    };
    document?: {
        id: string;
        filename: string;
        mime_type: string;
        sha256: string;
        caption?: string;
    };
    sticker?: {
        id: string;
        mime_type: string;
        sha256: string;
    };
    location?: {
        latitude: number;
        longitude: number;
        name?: string;
        address?: string;
    };
    contacts?: any[];
    interactive?: {
        type: string;
        button_reply?: any;
        list_reply?: any;
    };
    button?: {
        text: string;
        payload: string;
    };
}
interface WebhookStatus {
    id: string;
    status: 'sent' | 'delivered' | 'read' | 'failed';
    timestamp: string;
    recipient_id: string;
    conversation?: {
        id: string;
        origin: {
            type: string;
        };
        expiration_timestamp?: string;
    };
    errors?: Array<{
        code: number;
        title: string;
    }>;
}
declare class WebhookService {
    verifyWebhook(mode: string, token: string, challenge: string): string | null;
    processWebhook(payload: WebhookPayload): Promise<void>;
    private processMessagesChange;
    private processIncomingMessage;
    private processStatusUpdate;
    private mapMessageType;
    private extractMessageContent;
    private getMessagePreview;
}
export declare const webhookService: WebhookService;
export default webhookService;
//# sourceMappingURL=webhook.service.d.ts.map