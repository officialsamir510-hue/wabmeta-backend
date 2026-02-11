"use strict";
// src/modules/meta/meta.api.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.metaApi = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../../config");
class MetaApiClient {
    client;
    graphVersion;
    constructor() {
        this.graphVersion = config_1.config.meta.graphApiVersion || 'v18.0';
        this.client = axios_1.default.create({
            baseURL: `https://graph.facebook.com/${this.graphVersion}`,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
            },
        });
        // Request interceptor for logging
        this.client.interceptors.request.use((config) => {
            console.log(`[Meta API] ${config.method?.toUpperCase()} ${config.url}`);
            return config;
        }, (error) => {
            console.error('[Meta API] Request error:', error);
            return Promise.reject(error);
        });
        // Response interceptor for error handling
        this.client.interceptors.response.use((response) => response, (error) => {
            if (error.response?.data?.error) {
                const metaError = error.response.data.error;
                console.error('[Meta API] Error:', {
                    message: metaError.message,
                    code: metaError.code,
                    subcode: metaError.error_subcode,
                    type: metaError.type,
                    fbtrace_id: metaError.fbtrace_id,
                });
            }
            return Promise.reject(error);
        });
    }
    /**
     * Exchange short-lived code for access token
     */
    async exchangeCodeForToken(code) {
        try {
            const response = await this.client.get('/oauth/access_token', {
                params: {
                    client_id: config_1.config.meta.appId,
                    client_secret: config_1.config.meta.appSecret,
                    code: code,
                },
            });
            return {
                accessToken: response.data.access_token,
                tokenType: response.data.token_type || 'bearer',
                expiresIn: response.data.expires_in,
            };
        }
        catch (error) {
            throw this.handleError(error, 'Failed to exchange code for token');
        }
    }
    /**
     * Exchange short-lived token for long-lived token
     */
    async getLongLivedToken(shortLivedToken) {
        try {
            const response = await this.client.get('/oauth/access_token', {
                params: {
                    grant_type: 'fb_exchange_token',
                    client_id: config_1.config.meta.appId,
                    client_secret: config_1.config.meta.appSecret,
                    fb_exchange_token: shortLivedToken,
                },
            });
            return {
                accessToken: response.data.access_token,
                tokenType: response.data.token_type || 'bearer',
                expiresIn: response.data.expires_in, // Usually 60 days
            };
        }
        catch (error) {
            throw this.handleError(error, 'Failed to get long-lived token');
        }
    }
    /**
     * Debug/validate access token
     */
    async debugToken(accessToken) {
        try {
            const appToken = `${config_1.config.meta.appId}|${config_1.config.meta.appSecret}`;
            const response = await this.client.get('/debug_token', {
                params: {
                    input_token: accessToken,
                    access_token: appToken,
                },
            });
            return response.data;
        }
        catch (error) {
            throw this.handleError(error, 'Failed to debug token');
        }
    }
    /**
     * Get shared WABA (WhatsApp Business Account) list
     */
    async getSharedWABAs(accessToken) {
        try {
            // First, get the user ID
            const meResponse = await this.client.get('/me', {
                params: { access_token: accessToken },
            });
            // Get shared WABAs for this user
            const wabaResponse = await this.client.get(`/${meResponse.data.id}/businesses`, {
                params: {
                    access_token: accessToken,
                },
            });
            const businesses = wabaResponse.data.data || [];
            const wabas = [];
            // For each business, get shared WABAs
            for (const business of businesses) {
                try {
                    const sharedWabaResponse = await this.client.get(`/${business.id}/client_whatsapp_business_accounts`, {
                        params: {
                            access_token: accessToken,
                        },
                    });
                    if (sharedWabaResponse.data.data) {
                        wabas.push(...sharedWabaResponse.data.data);
                    }
                }
                catch (e) {
                    console.log(`No WABAs found for business ${business.id}`);
                }
            }
            // Also try direct WABA access
            try {
                const debugToken = await this.debugToken(accessToken);
                const granularScopes = debugToken.data.granular_scopes || [];
                for (const scope of granularScopes) {
                    if (scope.scope === 'whatsapp_business_management' && scope.target_ids) {
                        for (const wabaId of scope.target_ids) {
                            try {
                                const wabaDetails = await this.getWABADetails(wabaId, accessToken);
                                if (wabaDetails && !wabas.find((w) => w.id === wabaDetails.id)) {
                                    wabas.push(wabaDetails);
                                }
                            }
                            catch (e) {
                                console.log(`Failed to fetch WABA ${wabaId}`);
                            }
                        }
                    }
                }
            }
            catch (e) {
                console.log('Failed to get WABAs from debug token');
            }
            return wabas;
        }
        catch (error) {
            throw this.handleError(error, 'Failed to get shared WABAs');
        }
    }
    /**
     * Get WABA details
     */
    async getWABADetails(wabaId, accessToken) {
        try {
            const response = await this.client.get(`/${wabaId}`, {
                params: {
                    access_token: accessToken,
                    fields: 'id,name,currency,timezone_id,message_template_namespace,owner_business_info,on_behalf_of_business_info',
                },
            });
            return response.data;
        }
        catch (error) {
            throw this.handleError(error, 'Failed to get WABA details');
        }
    }
    /**
     * Get phone numbers for a WABA
     */
    async getPhoneNumbers(wabaId, accessToken) {
        try {
            const response = await this.client.get(`/${wabaId}/phone_numbers`, {
                params: {
                    access_token: accessToken,
                    fields: 'id,verified_name,display_phone_number,quality_rating,code_verification_status,platform_type,throughput',
                },
            });
            return (response.data.data || []).map((phone) => ({
                id: phone.id,
                verifiedName: phone.verified_name,
                displayPhoneNumber: phone.display_phone_number,
                qualityRating: phone.quality_rating,
                codeVerificationStatus: phone.code_verification_status,
                platformType: phone.platform_type,
                throughput: phone.throughput,
            }));
        }
        catch (error) {
            throw this.handleError(error, 'Failed to get phone numbers');
        }
    }
    /**
     * Subscribe app to WABA webhooks
     */
    async subscribeToWebhooks(wabaId, accessToken) {
        try {
            const response = await this.client.post(`/${wabaId}/subscribed_apps`, null, {
                params: {
                    access_token: accessToken,
                },
            });
            return response.data.success === true;
        }
        catch (error) {
            throw this.handleError(error, 'Failed to subscribe to webhooks');
        }
    }
    /**
     * Register phone number for messaging
     */
    async registerPhoneNumber(phoneNumberId, accessToken) {
        try {
            const response = await this.client.post(`/${phoneNumberId}/register`, {
                messaging_product: 'whatsapp',
                pin: '123456', // Required but not used for Cloud API
            }, {
                params: {
                    access_token: accessToken,
                },
            });
            return response.data.success === true;
        }
        catch (error) {
            // If already registered, that's fine
            if (error.response?.data?.error?.code === 10) {
                return true;
            }
            throw this.handleError(error, 'Failed to register phone number');
        }
    }
    /**
     * Get business profile
     */
    async getBusinessProfile(phoneNumberId, accessToken) {
        try {
            const response = await this.client.get(`/${phoneNumberId}/whatsapp_business_profile`, {
                params: {
                    access_token: accessToken,
                    fields: 'about,address,description,email,profile_picture_url,websites,vertical',
                },
            });
            return response.data.data?.[0] || {};
        }
        catch (error) {
            throw this.handleError(error, 'Failed to get business profile');
        }
    }
    /**
     * Send message via WhatsApp Cloud API
     */
    async sendMessage(phoneNumberId, accessToken, to, message) {
        try {
            const response = await this.client.post(`/${phoneNumberId}/messages`, {
                messaging_product: 'whatsapp',
                to: to,
                ...message,
            }, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            return {
                messageId: response.data.messages?.[0]?.id,
            };
        }
        catch (error) {
            throw this.handleError(error, 'Failed to send message');
        }
    }
    /**
     * Get message templates
     */
    async getTemplates(wabaId, accessToken) {
        try {
            const response = await this.client.get(`/${wabaId}/message_templates`, {
                params: {
                    access_token: accessToken,
                    fields: 'name,status,category,language,components',
                    limit: 100,
                },
            });
            return response.data.data || [];
        }
        catch (error) {
            throw this.handleError(error, 'Failed to get templates');
        }
    }
    /**
     * Create message template
     */
    async createTemplate(wabaId, accessToken, template) {
        try {
            const response = await this.client.post(`/${wabaId}/message_templates`, template, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            return {
                id: response.data.id,
                status: response.data.status,
            };
        }
        catch (error) {
            throw this.handleError(error, 'Failed to create template');
        }
    }
    handleError(error, defaultMessage) {
        if (error.response?.data?.error) {
            const metaError = error.response.data.error;
            const errorMessage = `${metaError.message} (Code: ${metaError.code})`;
            return new Error(errorMessage);
        }
        return new Error(error.message || defaultMessage);
    }
}
exports.metaApi = new MetaApiClient();
exports.default = exports.metaApi;
//# sourceMappingURL=meta.api.js.map