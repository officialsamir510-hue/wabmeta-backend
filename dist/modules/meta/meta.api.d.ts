import { TokenExchangeResponse, DebugTokenResponse, SharedWABAInfo, PhoneNumberInfo } from './meta.types';
declare class MetaApiClient {
    private client;
    private graphVersion;
    constructor();
    exchangeCodeForToken(code: string): Promise<TokenExchangeResponse>;
    getLongLivedToken(shortLivedToken: string): Promise<TokenExchangeResponse>;
    debugToken(accessToken: string): Promise<DebugTokenResponse>;
    validateToken(accessToken: string): Promise<boolean>;
    getSharedWABAs(accessToken: string): Promise<SharedWABAInfo[]>;
    getWABADetails(wabaId: string, accessToken: string): Promise<SharedWABAInfo>;
    /**
     * ✅ FIXED: Get phone numbers with proper snake_case mapping
     */
    getPhoneNumbers(wabaId: string, accessToken: string): Promise<PhoneNumberInfo[]>;
    registerPhoneNumber(phoneNumberId: string, accessToken: string): Promise<boolean>;
    subscribeToWebhooks(wabaId: string, accessToken: string): Promise<boolean>;
    unsubscribeFromWebhooks(wabaId: string, accessToken: string): Promise<boolean>;
    getBusinessProfile(phoneNumberId: string, accessToken: string): Promise<any>;
    updateBusinessProfile(phoneNumberId: string, accessToken: string, profile: {
        about?: string;
        address?: string;
        description?: string;
        email?: string;
        websites?: string[];
        vertical?: string;
    }): Promise<boolean>;
    sendMessage(phoneNumberId: string, accessToken: string, to: string, message: any): Promise<{
        messageId: string;
        contacts?: any[];
    }>;
    markMessageAsRead(phoneNumberId: string, accessToken: string, messageId: string): Promise<boolean>;
    getTemplates(wabaId: string, accessToken: string): Promise<any[]>;
    getTemplate(templateId: string, accessToken: string): Promise<any>;
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
    deleteTemplate(wabaId: string, accessToken: string, templateName: string): Promise<boolean>;
    uploadMedia(phoneNumberId: string, accessToken: string, file: Buffer, mimeType: string, filename: string): Promise<{
        id: string;
    }>;
    getMediaUrl(mediaId: string, accessToken: string): Promise<string>;
    downloadMedia(mediaUrl: string, accessToken: string): Promise<Buffer>;
    getAnalytics(wabaId: string, accessToken: string, params: {
        start: number;
        end: number;
        granularity: 'HALF_HOUR' | 'DAILY' | 'MONTHLY';
        metrics?: string[];
    }): Promise<any>;
    private handleError;
    isTokenValid(accessToken: string): Promise<boolean>;
    getTokenExpiry(accessToken: string): Promise<Date | null>;
    getGraphVersion(): string;
}
export declare const metaApi: MetaApiClient;
export default metaApi;
//# sourceMappingURL=meta.api.d.ts.map