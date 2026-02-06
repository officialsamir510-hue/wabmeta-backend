import { config } from "../../config";
import {
  MetaTokenResponse,
  MetaBusinessAccount,
  MetaPhoneNumber,
  MetaMessageResponse,
  MetaTemplateResponse,
  SendMessageInput,
  MediaUrlResponse,
} from "./whatsapp.types";

const META_GRAPH_URL = "https://graph.facebook.com/v19.0";

// ---------- helpers ----------
class MetaApiError extends Error {
  status?: number;
  meta?: any;
  constructor(message: string, status?: number, meta?: any) {
    super(message);
    this.name = "MetaApiError";
    this.status = status;
    this.meta = meta;
  }
}

const fetchWithTimeout = async (
  url: string,
  options: RequestInit = {},
  timeoutMs = 20000
) => {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new MetaApiError(`Meta API timeout after ${timeoutMs}ms`, 408);
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
};

const safeJson = async (res: Response) => {
  try {
    return await res.json();
  } catch {
    return null;
  }
};

// ============================================
// META API CLIENT CLASS
// ============================================

export class MetaApiClient {
  private accessToken: string;
  private phoneNumberId: string;
  private wabaId: string;

  constructor(accessToken: string, phoneNumberId: string, wabaId: string = "") {
    this.accessToken = accessToken;
    this.phoneNumberId = phoneNumberId;
    this.wabaId = wabaId;
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${META_GRAPH_URL}${endpoint}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...((options.headers as Record<string, string>) || {}),
    };

    const res = await fetchWithTimeout(
      url,
      { ...options, headers },
      20000
    );

    const data: any = await safeJson(res);

    if (!res.ok) {
      const err = data?.error || data;
      const msg =
        err?.message ||
        `Meta API Error: ${res.status} ${res.statusText}`;
      throw new MetaApiError(msg, res.status, err);
    }

    return data as T;
  }

  // ==========================================
  // OAUTH METHODS
  // ==========================================

  static async exchangeCodeForToken(code: string, redirectUri: string): Promise<MetaTokenResponse> {
    if (!config.meta.appId || !config.meta.appSecret) {
      throw new MetaApiError("META_APP_ID / META_APP_SECRET missing on server", 500);
    }

    const params = new URLSearchParams({
      client_id: config.meta.appId,
      client_secret: config.meta.appSecret,
      code,
      redirect_uri: redirectUri,
    });

    const url = `${META_GRAPH_URL}/oauth/access_token?${params.toString()}`;
    const res = await fetchWithTimeout(url, { method: "GET" }, 20000);
    const data: any = await safeJson(res);

    if (!res.ok) {
      const msg = data?.error?.message || "Failed to exchange code for token";
      throw new MetaApiError(msg, res.status, data?.error || data);
    }

    return data as MetaTokenResponse;
  }

  static async getLongLivedToken(shortLivedToken: string): Promise<MetaTokenResponse> {
    const params = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: config.meta.appId,
      client_secret: config.meta.appSecret,
      fb_exchange_token: shortLivedToken,
    });

    const url = `${META_GRAPH_URL}/oauth/access_token?${params.toString()}`;
    const res = await fetchWithTimeout(url, { method: "GET" }, 20000);
    const data: any = await safeJson(res);

    if (!res.ok) {
      const msg = data?.error?.message || "Failed to get long-lived token";
      throw new MetaApiError(msg, res.status, data?.error || data);
    }

    return data as MetaTokenResponse;
  }

  // ==========================================
  // BUSINESS ACCOUNT METHODS
  // ==========================================

  async getBusinessAccounts(): Promise<MetaBusinessAccount[]> {
    const data = await this.request<{ data: MetaBusinessAccount[] }>(
      "/me/businesses?fields=id,name,timezone_id,owned_whatsapp_business_accounts"
    );
    return data.data || [];
  }

  async getWhatsAppBusinessAccounts(): Promise<any[]> {
    const data = await this.request<{ data: any[] }>(
      "/me/whatsapp_business_accounts?fields=id,name,message_template_namespace"
    );
    return data.data || [];
  }

  async getPhoneNumbers(wabaId: string): Promise<MetaPhoneNumber[]> {
    const data = await this.request<{ data: MetaPhoneNumber[] }>(
      `/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status,platform_type`
    );
    return data.data || [];
  }

  // ==========================================
  // MESSAGING METHODS
  // ==========================================

  async sendMessage(input: SendMessageInput): Promise<MetaMessageResponse> {
    const payload: any = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: input.to.replace(/\D/g, ""),
    };

    switch (input.type) {
      case "text":
        payload.type = "text";
        payload.text = input.text;
        break;
      case "template":
        payload.type = "template";
        payload.template = input.template;
        break;
      case "image":
        payload.type = "image";
        payload.image = input.image;
        break;
      case "video":
        payload.type = "video";
        payload.video = input.video;
        break;
      case "audio":
        payload.type = "audio";
        payload.audio = input.audio;
        break;
      case "document":
        payload.type = "document";
        payload.document = input.document;
        break;
      case "location":
        payload.type = "location";
        payload.location = input.location;
        break;
      case "interactive":
        payload.type = "interactive";
        payload.interactive = input.interactive;
        break;
    }

    if (input.context) payload.context = input.context;

    return this.request<MetaMessageResponse>(`/${this.phoneNumberId}/messages`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async sendTextMessage(to: string, text: string, previewUrl = false, replyToMessageId?: string) {
    return this.sendMessage({
      to,
      type: "text",
      text: { body: text, preview_url: previewUrl },
      context: replyToMessageId ? { message_id: replyToMessageId } : undefined,
    });
  }

  async sendTemplateMessage(to: string, templateName: string, languageCode: string, components?: any[]) {
    return this.sendMessage({
      to,
      type: "template",
      template: { name: templateName, language: { code: languageCode }, components },
    });
  }

  async sendImageMessage(to: string, imageUrl: string, caption?: string) {
    return this.sendMessage({ to, type: "image", image: { link: imageUrl, caption } });
  }

  async sendVideoMessage(to: string, videoUrl: string, caption?: string) {
    return this.sendMessage({ to, type: "video", video: { link: videoUrl, caption } });
  }

  async sendDocumentMessage(to: string, documentUrl: string, filename: string, caption?: string) {
    return this.sendMessage({ to, type: "document", document: { link: documentUrl, filename, caption } });
  }

  async markAsRead(messageId: string): Promise<boolean> {
    try {
      await this.request(`/${this.phoneNumberId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          messaging_product: "whatsapp",
          status: "read",
          message_id: messageId,
        }),
      });
      return true;
    } catch {
      return false;
    }
  }

  // ==========================================
  // MEDIA METHODS
  // ==========================================
  async getMediaUrl(mediaId: string): Promise<MediaUrlResponse> {
    return this.request<MediaUrlResponse>(`/${mediaId}`);
  }

  // ==========================================
  // TEMPLATE METHODS
  // ==========================================
  async getTemplates(wabaId?: string): Promise<MetaTemplateResponse[]> {
    const id = wabaId || this.wabaId;
    if (!id) throw new MetaApiError("WABA ID is required", 400);

    const data = await this.request<{ data: MetaTemplateResponse[] }>(
      `/${id}/message_templates?fields=id,name,status,category,language,components&limit=100`
    );
    return data.data || [];
  }
}