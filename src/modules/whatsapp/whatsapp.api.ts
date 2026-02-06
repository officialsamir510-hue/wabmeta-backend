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
  // Exchange code -> short-lived user access token
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

  // Exchange short-lived -> long-lived
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

  // Get businesses for the user
  async getUserBusinesses(accessToken: string) {
    const res = await graph.get("/me/businesses", {
      params: { access_token: accessToken, limit: 50 },
    });
    return res.data?.data || [];
  },

  // Owned WABAs for business
  async getOwnedWabas(businessId: string, accessToken: string) {
    const res = await graph.get(`/${businessId}/owned_whatsapp_business_accounts`, {
      params: { access_token: accessToken, limit: 50 },
    });
    return res.data?.data || [];
  },

  // Phone numbers under WABA
  async getWabaPhoneNumbers(wabaId: string, accessToken: string) {
    const res = await graph.get(`/${wabaId}/phone_numbers`, {
      params: { access_token: accessToken, limit: 50 },
    });
    return res.data?.data || [];
  },

  // Subscribe app to this WABA (important)
  async subscribeAppToWaba(wabaId: string, accessToken: string) {
    const res = await graph.post(
      `/${wabaId}/subscribed_apps`,
      {},
      { params: { access_token: accessToken } }
    );
    return res.data;
  },
};