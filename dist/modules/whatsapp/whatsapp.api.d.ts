export type AccessTokenResponse = {
    access_token: string;
    token_type: string;
    expires_in?: number;
};
export declare const whatsappApi: {
    /**
     * Exchange OAuth code for short-lived access token
     */
    exchangeCodeForToken(code: string, redirectUri: string): Promise<AccessTokenResponse>;
    /**
     * Exchange short-lived token for long-lived token (60 days)
     */
    exchangeForLongLivedToken(shortLivedToken: string): Promise<AccessTokenResponse>;
    /**
     * Get current user info
     */
    getMe(accessToken: string): Promise<any>;
    /**
     * Debug token - check validity, scopes, expiry
     * Uses unversioned endpoint for best compatibility
     */
    debugToken(inputToken: string): Promise<any>;
    /**
     * Get businesses owned by the user
     */
    getUserBusinesses(accessToken: string): Promise<any>;
    /**
     * Get WhatsApp Business Accounts owned by a business
     */
    getOwnedWabas(businessId: string, accessToken: string): Promise<any>;
    /**
     * Get phone numbers under a WABA
     */
    getWabaPhoneNumbers(wabaId: string, accessToken: string): Promise<any>;
    /**
     * Subscribe app to WABA webhooks
     */
    subscribeAppToWaba(wabaId: string, accessToken: string): Promise<any>;
    /**
     * Send message via Cloud API
     */
    sendMessage(phoneNumberId: string, accessToken: string, payload: any): Promise<any>;
    /**
     * Mark message as read
     */
    markAsRead(phoneNumberId: string, accessToken: string, messageId: string): Promise<any>;
    /**
     * Create message template on Meta WABA
     */
    createMessageTemplate(wabaId: string, accessToken: string, payload: any): Promise<any>;
    /**
     * List all templates from Meta WABA
     */
    listMessageTemplates(wabaId: string, accessToken: string): Promise<any>;
    /**
     * Get single template by ID
     */
    getMessageTemplate(templateId: string, accessToken: string): Promise<any>;
    /**
     * Delete template from Meta WABA
     */
    deleteMessageTemplate(wabaId: string, accessToken: string, templateName: string): Promise<any>;
    /**
     * Upload media to WhatsApp
     */
    uploadMedia(phoneNumberId: string, accessToken: string, formData: FormData): Promise<any>;
    /**
     * Get media URL by media ID
     */
    getMediaUrl(mediaId: string, accessToken: string): Promise<any>;
    /**
     * Download media from URL
     */
    downloadMedia(mediaUrl: string, accessToken: string): Promise<any>;
    /**
     * Get phone number details
     */
    getPhoneNumberInfo(phoneNumberId: string, accessToken: string): Promise<any>;
    /**
     * Register phone number for WhatsApp
     */
    registerPhoneNumber(phoneNumberId: string, accessToken: string, pin: string): Promise<any>;
};
//# sourceMappingURL=whatsapp.api.d.ts.map