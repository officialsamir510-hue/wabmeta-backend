import axios from "axios";
import { config } from "../../config";

const GRAPH_VERSION = "v19.0";

const graph = axios.create({
  baseURL: `https://graph.facebook.com/${GRAPH_VERSION}`,
  timeout: 30000,
});

export type AccessTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in?: number;
};

export const whatsappApi = {
  async exchangeCodeForToken(code: string, redirectUri: string): Promise<AccessTokenResponse> {
    const params = {
      client_id: config.meta.appId,
      client_secret: config.meta.appSecret,
      redirect_uri: redirectUri,
      code,
    };

    const res = await graph.get("/oauth/access_token", { params });
    return res.data;
  },

  async exchangeForLongLivedToken(shortLivedToken: string): Promise<AccessTokenResponse> {
    const params = {
      grant_type: "fb_exchange_token",
      client_id: config.meta.appId,
      client_secret: config.meta.appSecret,
      fb_exchange_token: shortLivedToken,
    };

    const res = await graph.get("/oauth/access_token", { params });
    return res.data;
  },

  async getUserBusinesses(accessToken: string) {
    const res = await graph.get("/me/businesses", {
      params: { access_token: accessToken, limit: 50 },
    });
    return res.data?.data || [];
  },

  async getOwnedWabas(businessId: string, accessToken: string) {
    const res = await graph.get(`/${businessId}/owned_whatsapp_business_accounts`, {
      params: { access_token: accessToken, limit: 50 },
    });
    return res.data?.data || [];
  },

  async getWabaPhoneNumbers(wabaId: string, accessToken: string) {
    const res = await graph.get(`/${wabaId}/phone_numbers`, {
      params: { access_token: accessToken, limit: 50 },
    });
    return res.data?.data || [];
  },

  async subscribeAppToWaba(wabaId: string, accessToken: string) {
    const res = await graph.post(
      `/${wabaId}/subscribed_apps`,
      {},
      { params: { access_token: accessToken } }
    );
    return res.data;
  },

  // ✅ Send message via Cloud API
  async sendMessage(phoneNumberId: string, accessToken: string, payload: any) {
    const res = await graph.post(`/${phoneNumberId}/messages`, payload, {
      params: { access_token: accessToken },
      headers: { "Content-Type": "application/json" },
    });
    return res.data;
  },
// ✅ Create message template on Meta (WABA)
async createMessageTemplate(wabaId: string, accessToken: string, payload: any) {
  const res = await graph.post(`/${wabaId}/message_templates`, payload, {
    params: { access_token: accessToken },
    headers: { "Content-Type": "application/json" },
  });
  return res.data;
},

// ✅ List templates from Meta
async listMessageTemplates(wabaId: string, accessToken: string) {
  const res = await graph.get(`/${wabaId}/message_templates`, {
    params: { access_token: accessToken, limit: 200 },
  });
  return res.data?.data || [];
},

// ✅ Check token validity + scopes
async debugToken(inputToken: string) {
  const appAccessToken = `${config.meta.appId}|${config.meta.appSecret}`;
  const res = await graph.get(`/debug_token`, {
    params: {
      input_token: inputToken,
      access_token: appAccessToken,
    },
  });
  return res.data;
},

async getMe(accessToken: string) {
  const res = await graph.get(`/me`, {
    params: { access_token: accessToken, fields: "id,name" },
  });
  return res.data;
}
};