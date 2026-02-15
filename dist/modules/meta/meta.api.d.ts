import { TokenExchangeResponse, DebugTokenResponse, SharedWABAInfo, PhoneNumberInfo } from './meta.types';
declare class MetaApiClient {
    private client;
    private graphVersion;
    constructor();
    /**
     * Exchange authorization code for access token - ✅ UPDATED with redirect_uri
     */
    exchangeCodeForToken(code: string): Promise<TokenExchangeResponse>;
    /**
     * Exchange short-lived token for long-lived token
     */
    getLongLivedToken(shortLivedToken: string): Promise<TokenExchangeResponse>;
    /**
     * Debug/validate access token
     */
    debugToken(accessToken: string): Promise<DebugTokenResponse>;
    /**
     * Validate if a token is valid and active
     */
    validateToken(accessToken: string): Promise<boolean>;
    /**
     * Get shared WABA list
     */
    getSharedWABAs(accessToken: string): Promise<SharedWABAInfo[]>;
    /**
     * Get WABA details
     */
    getWABADetails(wabaId: string, accessToken: string): Promise<SharedWABAInfo>;
    /**
     * Get phone numbers for a WABA
     */
    getPhoneNumbers(wabaId: string, accessToken: string): Promise<PhoneNumberInfo[]>;
    /**
     * Register phone number for messaging
     */
    registerPhoneNumber(phoneNumberId: string, accessToken: string): Promise<boolean>;
    /**
     * Subscribe app to WABA webhooks
     */
    subscribeToWebhooks(wabaId: string, accessToken: string): Promise<boolean>;
    /**
     * Unsubscribe app from WABA webhooks
     */
    unsubscribeFromWebhooks(wabaId: string, accessToken: string): Promise<boolean>;
    /**
     * Get business profile
     */
    getBusinessProfile(phoneNumberId: string, accessToken: string): Promise<any>;
    /**
     * Update business profile
     */
    updateBusinessProfile(phoneNumberId: string, accessToken: string, profile: {
        about?: string;
        address?: string;
        description?: string;
        email?: string;
        websites?: string[];
        vertical?: string;
    }): Promise<boolean>;
    /**
     * Send message via WhatsApp Cloud API
     */
    sendMessage(phoneNumberId: string, accessToken: string, to: string, message: any): Promise<{
        messageId: string;
        contacts?: any[];
    }>;
    /**
     * Mark message as read
     */
    markMessageAsRead(phoneNumberId: string, accessToken: string, messageId: string): Promise<boolean>;
    /**
     * Get message templates
     */
    getTemplates(wabaId: string, accessToken: string): Promise<any[]>;
    /**
     * Get single template by ID
     */
    getTemplate(templateId: string, accessToken: string): Promise<any>;
    /**
     * Create message template
     */
    createTemplate(wabaId: string, accessToken: string, template: {
        name: string;
        category: string;
        language: string;
        components: any[];
        allow_category_change?: boolean;
    }): Promise<{
        id: string;
        status: string;
    }>;
    /**
     * Delete message template
     */
    deleteTemplate(wabaId: string, accessToken: string, templateName: string): Promise<boolean>;
    /**
     * Upload media file
     */
    uploadMedia(phoneNumberId: string, accessToken: string, file: Buffer, mimeType: string, filename: string): Promise<{
        id: string;
    }>;
    /**
     * Get media URL
     */
    getMediaUrl(mediaId: string, accessToken: string): Promise<string>;
    /**
     * Download media
     */
    downloadMedia(mediaUrl: string, accessToken: string): Promise<Buffer>;
    /**
     * Get analytics/insights
     */
    getAnalytics(wabaId: string, accessToken: string, params: {
        start: number;
        end: number;
        granularity: 'HALF_HOUR' | 'DAILY' | 'MONTHLY';
        metrics?: string[];
    }): Promise<any>;
    /**
     * Handle and format errors
     */
    private handleError;
    /**
     * Check if token is valid
     */
    isTokenValid(accessToken: string): Promise<boolean>;
    /**
     * Get token expiry date
     */
    getTokenExpiry(accessToken: string): Promise<Date | null>;
    /**
     * Get Graph API version
     */
    getGraphVersion(): string;
}
export declare const metaApi: MetaApiClient;
export default metaApi;
//# sourceMappingURL=meta.api.d.ts.map