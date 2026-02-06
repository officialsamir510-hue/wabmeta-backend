// src/modules/whatsapp/whatsapp.api.ts

import axios from "axios";
import crypto from "crypto";
import { config } from "../../config";

const GRAPH_VERSION = "v19.0";

// Versioned graph (normal endpoints)
const graph = axios.create({
  baseURL: `https://graph.facebook.com/${GRAPH_VERSION}`,
  timeout: 30000,
});

// Unversioned graph (debug_token works better here)
const graphBase = axios.create({
  baseURL: `https://graph.facebook.com`,
  timeout: 30000,
});

export type AccessTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in?: number;
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate appsecret_proof for secure API calls
 * Required when "Require App Secret" is enabled in Meta App settings
 */
const appSecretProof = (userAccessToken: string): string | undefined => {
  if (!config.meta.appSecret) return undefined;
  return crypto
    .createHmac("sha256", config.meta.appSecret)
    .update(userAccessToken)
    .digest("hex");
};

/**
 * Extract useful error info from Axios errors
 */
const axiosErrInfo = (e: any) => ({
  status: e?.response?.status,
  data: e?.response?.data,
  message: e?.message,
});

// ============================================
// WHATSAPP API METHODS
// ============================================

export const whatsappApi = {
  // -----------------------------
  // OAUTH & TOKEN
  // -----------------------------

  /**
   * Exchange OAuth code for short-lived access token
   */
  async exchangeCodeForToken(code: string, redirectUri: string): Promise<AccessTokenResponse> {
    const params = {
      client_id: config.meta.appId,
      client_secret: config.meta.appSecret,
      redirect_uri: redirectUri,
      code,
    };

    try {
      const res = await graph.get("/oauth/access_token", { params });
      return res.data;
    } catch (e: any) {
      console.error("❌ Meta exchangeCodeForToken failed:", axiosErrInfo(e));
      throw e;
    }
  },

  /**
   * Exchange short-lived token for long-lived token (60 days)
   */
  async exchangeForLongLivedToken(shortLivedToken: string): Promise<AccessTokenResponse> {
    const params = {
      grant_type: "fb_exchange_token",
      client_id: config.meta.appId,
      client_secret: config.meta.appSecret,
      fb_exchange_token: shortLivedToken,
    };

    try {
      const res = await graph.get("/oauth/access_token", { params });
      return res.data;
    } catch (e: any) {
      console.error("❌ Meta exchangeForLongLivedToken failed:", axiosErrInfo(e));
      throw e;
    }
  },

  /**
   * Get current user info
   */
  async getMe(accessToken: string) {
    try {
      const res = await graph.get("/me", {
        params: {
          access_token: accessToken,
          fields: "id,name",
        },
      });
      return res.data;
    } catch (e: any) {
      console.error("❌ Meta /me failed:", axiosErrInfo(e));
      throw e;
    }
  },

  /**
   * Debug token - check validity, scopes, expiry
   * Uses unversioned endpoint for best compatibility
   */
  async debugToken(inputToken: string) {
    const appAccessToken = `${config.meta.appId}|${config.meta.appSecret}`;

    try {
      const res = await graphBase.get("/debug_token", {
        params: {
          input_token: inputToken,
          access_token: appAccessToken,
        },
      });
      return res.data;
    } catch (e: any) {
      console.error("❌ Meta debug_token failed:", axiosErrInfo(e));
      throw e;
    }
  },

  // -----------------------------
  // BUSINESS & WABA
  // -----------------------------

  /**
   * Get businesses owned by the user
   */
  async getUserBusinesses(accessToken: string) {
    try {
      const res = await graph.get("/me/businesses", {
        params: {
          access_token: accessToken,
          limit: 50,
          appsecret_proof: appSecretProof(accessToken),
        },
      });
      return res.data?.data || [];
    } catch (e: any) {
      console.error("❌ Meta /me/businesses failed:", axiosErrInfo(e));
      throw e;
    }
  },

  /**
   * Get WhatsApp Business Accounts owned by a business
   */
  async getOwnedWabas(businessId: string, accessToken: string) {
    try {
      const res = await graph.get(`/${businessId}/owned_whatsapp_business_accounts`, {
        params: {
          access_token: accessToken,
          limit: 50,
          appsecret_proof: appSecretProof(accessToken),
        },
      });
      return res.data?.data || [];
    } catch (e: any) {
      console.error("❌ Meta getOwnedWabas failed:", axiosErrInfo(e));
      throw e;
    }
  },

  /**
   * Get phone numbers under a WABA
   */
  async getWabaPhoneNumbers(wabaId: string, accessToken: string) {
    try {
      const res = await graph.get(`/${wabaId}/phone_numbers`, {
        params: {
          access_token: accessToken,
          limit: 50,
          appsecret_proof: appSecretProof(accessToken),
        },
      });
      return res.data?.data || [];
    } catch (e: any) {
      console.error("❌ Meta getWabaPhoneNumbers failed:", axiosErrInfo(e));
      throw e;
    }
  },

  /**
   * Subscribe app to WABA webhooks
   */
  async subscribeAppToWaba(wabaId: string, accessToken: string) {
    try {
      const res = await graph.post(
        `/${wabaId}/subscribed_apps`,
        {},
        {
          params: {
            access_token: accessToken,
            appsecret_proof: appSecretProof(accessToken),
          },
        }
      );
      return res.data;
    } catch (e: any) {
      console.error("❌ Meta subscribeAppToWaba failed:", axiosErrInfo(e));
      throw e;
    }
  },

  // -----------------------------
  // MESSAGING
  // -----------------------------

  /**
   * Send message via Cloud API
   */
  async sendMessage(phoneNumberId: string, accessToken: string, payload: any) {
    try {
      const res = await graph.post(`/${phoneNumberId}/messages`, payload, {
        params: {
          access_token: accessToken,
          appsecret_proof: appSecretProof(accessToken),
        },
        headers: { "Content-Type": "application/json" },
      });
      return res.data;
    } catch (e: any) {
      console.error("❌ Meta sendMessage failed:", axiosErrInfo(e));
      throw e;
    }
  },

  /**
   * Mark message as read
   */
  async markAsRead(phoneNumberId: string, accessToken: string, messageId: string) {
    try {
      const res = await graph.post(
        `/${phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          status: "read",
          message_id: messageId,
        },
        {
          params: {
            access_token: accessToken,
            appsecret_proof: appSecretProof(accessToken),
          },
          headers: { "Content-Type": "application/json" },
        }
      );
      return res.data;
    } catch (e: any) {
      console.error("❌ Meta markAsRead failed:", axiosErrInfo(e));
      throw e;
    }
  },

  // -----------------------------
  // TEMPLATES
  // -----------------------------

  /**
   * Create message template on Meta WABA
   */
  async createMessageTemplate(wabaId: string, accessToken: string, payload: any) {
    try {
      const res = await graph.post(`/${wabaId}/message_templates`, payload, {
        params: {
          access_token: accessToken,
          appsecret_proof: appSecretProof(accessToken),
        },
        headers: { "Content-Type": "application/json" },
      });
      return res.data;
    } catch (e: any) {
      console.error("❌ Meta createMessageTemplate failed:", axiosErrInfo(e));
      throw e;
    }
  },

  /**
   * List all templates from Meta WABA
   */
  async listMessageTemplates(wabaId: string, accessToken: string) {
    try {
      const res = await graph.get(`/${wabaId}/message_templates`, {
        params: {
          access_token: accessToken,
          limit: 200,
          appsecret_proof: appSecretProof(accessToken),
        },
      });
      return res.data?.data || [];
    } catch (e: any) {
      console.error("❌ Meta listMessageTemplates failed:", axiosErrInfo(e));
      throw e;
    }
  },

  /**
   * Get single template by ID
   */
  async getMessageTemplate(templateId: string, accessToken: string) {
    try {
      const res = await graph.get(`/${templateId}`, {
        params: {
          access_token: accessToken,
          appsecret_proof: appSecretProof(accessToken),
        },
      });
      return res.data;
    } catch (e: any) {
      console.error("❌ Meta getMessageTemplate failed:", axiosErrInfo(e));
      throw e;
    }
  },

  /**
   * Delete template from Meta WABA
   */
  async deleteMessageTemplate(wabaId: string, accessToken: string, templateName: string) {
    try {
      const res = await graph.delete(`/${wabaId}/message_templates`, {
        params: {
          access_token: accessToken,
          name: templateName,
          appsecret_proof: appSecretProof(accessToken),
        },
      });
      return res.data;
    } catch (e: any) {
      console.error("❌ Meta deleteMessageTemplate failed:", axiosErrInfo(e));
      throw e;
    }
  },

  // -----------------------------
  // MEDIA
  // -----------------------------

  /**
   * Upload media to WhatsApp
   */
  async uploadMedia(phoneNumberId: string, accessToken: string, formData: FormData) {
    try {
      const res = await graph.post(`/${phoneNumberId}/media`, formData, {
        params: {
          access_token: accessToken,
          appsecret_proof: appSecretProof(accessToken),
        },
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    } catch (e: any) {
      console.error("❌ Meta uploadMedia failed:", axiosErrInfo(e));
      throw e;
    }
  },

  /**
   * Get media URL by media ID
   */
  async getMediaUrl(mediaId: string, accessToken: string) {
    try {
      const res = await graph.get(`/${mediaId}`, {
        params: {
          access_token: accessToken,
          appsecret_proof: appSecretProof(accessToken),
        },
      });
      return res.data;
    } catch (e: any) {
      console.error("❌ Meta getMediaUrl failed:", axiosErrInfo(e));
      throw e;
    }
  },

  /**
   * Download media from URL
   */
  async downloadMedia(mediaUrl: string, accessToken: string) {
    try {
      const res = await axios.get(mediaUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        responseType: "arraybuffer",
      });
      return res.data;
    } catch (e: any) {
      console.error("❌ Meta downloadMedia failed:", axiosErrInfo(e));
      throw e;
    }
  },

  // -----------------------------
  // PHONE NUMBER INFO
  // -----------------------------

  /**
   * Get phone number details
   */
  async getPhoneNumberInfo(phoneNumberId: string, accessToken: string) {
    try {
      const res = await graph.get(`/${phoneNumberId}`, {
        params: {
          access_token: accessToken,
          fields: "verified_name,code_verification_status,display_phone_number,quality_rating,platform_type,throughput,id",
          appsecret_proof: appSecretProof(accessToken),
        },
      });
      return res.data;
    } catch (e: any) {
      console.error("❌ Meta getPhoneNumberInfo failed:", axiosErrInfo(e));
      throw e;
    }
  },

  /**
   * Register phone number for WhatsApp
   */
  async registerPhoneNumber(phoneNumberId: string, accessToken: string, pin: string) {
    try {
      const res = await graph.post(
        `/${phoneNumberId}/register`,
        {
          messaging_product: "whatsapp",
          pin,
        },
        {
          params: {
            access_token: accessToken,
            appsecret_proof: appSecretProof(accessToken),
          },
          headers: { "Content-Type": "application/json" },
        }
      );
      return res.data;
    } catch (e: any) {
      console.error("❌ Meta registerPhoneNumber failed:", axiosErrInfo(e));
      throw e;
    }
  },
};