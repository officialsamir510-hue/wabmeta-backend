import { TokenExchangeResponse, DebugTokenResponse, SharedWABAInfo, PhoneNumberInfo } from './meta.types';
declare class MetaApiClient {
    private client;
    private graphVersion;
    constructor();
    /**
     * Exchange short-lived code for access token
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
     * Get shared WABA (WhatsApp Business Account) list
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
     * Subscribe app to WABA webhooks
     */
    subscribeToWebhooks(wabaId: string, accessToken: string): Promise<boolean>;
    /**
     * Register phone number for messaging
     */
    registerPhoneNumber(phoneNumberId: string, accessToken: string): Promise<boolean>;
    /**
     * Get business profile
     */
    getBusinessProfile(phoneNumberId: string, accessToken: string): Promise<any>;
    /**
     * Send message via WhatsApp Cloud API
     */
    sendMessage(phoneNumberId: string, accessToken: string, to: string, message: any): Promise<{
        messageId: string;
    }>;
    /**
     * Get message templates
     */
    getTemplates(wabaId: string, accessToken: string): Promise<any[]>;
    /**
     * Create message template
     */
    createTemplate(wabaId: string, accessToken: string, template: {
        name: string;
        category: string;
        language: string;
        components: any[];
    }): Promise<{
        id: string;
        status: string;
    }>;
    private handleError;
}
export declare const metaApi: MetaApiClient;
export default metaApi;
//# sourceMappingURL=meta.api.d.ts.map