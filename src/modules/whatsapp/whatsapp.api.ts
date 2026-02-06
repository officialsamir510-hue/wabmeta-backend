/* eslint-disable @typescript-eslint/no-explicit-any */
import { config } from '../../config';
import {
  MetaTokenResponse,
  MetaBusinessAccount,
  MetaPhoneNumber,
  MetaMessageResponse,
  MetaTemplateResponse,
  SendMessageInput,
  MediaUrlResponse,
} from './whatsapp.types';

const META_GRAPH_URL = 'https://graph.facebook.com/v19.0';

class MetaApiError extends Error {
  status?: number;
  meta?: any;
  constructor(message: string, status?: number, meta?: any) {
    super(message);
    this.name = 'MetaApiError';
    this.status = status;
    this.meta = meta;
  }
}

// ---------- helpers ----------
const safeJson = async (res: Response) => {
  try {
    return await res.json();
  } catch {
    return null;
  }
};

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
    if (e?.name === 'AbortError') {
      throw new MetaApiError(`Meta API timeout after ${timeoutMs}ms`, 408);
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
};

// ============================================
// META API CLIENT CLASS
// ============================================

export class MetaApiClient {
  private accessToken: string;
  private phoneNumberId: string;
  private wabaId: string;

  constructor(accessToken: string, phoneNumberId: string, wabaId: string = '') {
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
      Accept: 'application/json',
      ...(((options.headers as any) || {}) as Record<string, string>),
    };

    // Set JSON content-type only when body is string (JSON)
    if (typeof options.body === 'string') {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetchWithTimeout(
      url,
      {
        ...options,
        headers,
      },
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
      throw new MetaApiError('META_APP_ID / META_APP_SECRET missing on server', 500);
    }

    const params = new URLSearchParams({
      client_id: config.meta.appId,
      client_secret: config.meta.appSecret,
      code,
      redirect_uri: redirectUri,
    });

    const url = `${META_GRAPH_URL}/oauth/access_token?${params.toString()}`;
    const res = await fetchWithTimeout(url, { method: 'GET' }, 20000);
    const data: any = await safeJson(res);

    if (!res.ok) {
      const msg = data?.error?.message || 'Failed to exchange code for token';
      throw new MetaApiError(msg, res.status, data?.error || data);
    }

    return data as MetaTokenResponse;
  }

  static async getLongLivedToken(shortLivedToken: string): Promise<MetaTokenResponse> {
    if (!config.meta.appId || !config.meta.appSecret) {
      throw new MetaApiError('META_APP_ID / META_APP_SECRET missing on server', 500);
    }

    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: config.meta.appId,
      client_secret: config.meta.appSecret,
      fb_exchange_token: shortLivedToken,
    });

    const url = `${META_GRAPH_URL}/oauth/access_token?${params.toString()}`;
    const res = await fetchWithTimeout(url, { method: 'GET' }, 20000);
    const data: any = await safeJson(res);

    if (!res.ok) {
      const msg = data?.error?.message || 'Failed to get long-lived token';
      throw new MetaApiError(msg, res.status, data?.error || data);
    }

    return data as MetaTokenResponse;
  }

  // ==========================================
  // BUSINESS ACCOUNT METHODS
  // ==========================================
  async getBusinessAccounts(): Promise<MetaBusinessAccount[]> {
    const data = await this.request<{ data: MetaBusinessAccount[] }>(
      '/me/businesses?fields=id,name,timezone_id,owned_whatsapp_business_accounts'
    );
    return data.data || [];
  }

  async getWhatsAppBusinessAccounts(): Promise<any[]> {
    const data = await this.request<{ data: any[] }>(
      '/me/whatsapp_business_accounts?fields=id,name,message_template_namespace'
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
    if (!this.phoneNumberId) {
      throw new MetaApiError('phoneNumberId is required to send messages', 400);
    }

    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: input.to.replace(/\D/g, ''),
    };

    switch (input.type) {
      case 'text':
        payload.type = 'text';
        payload.text = input.text;
        break;

      case 'template':
        payload.type = 'template';
        payload.template = input.template;
        break;

      case 'image':
        payload.type = 'image';
        payload.image = input.image;
        break;

      case 'video':
        payload.type = 'video';
        payload.video = input.video;
        break;

      case 'audio':
        payload.type = 'audio';
        payload.audio = input.audio;
        break;

      case 'document':
        payload.type = 'document';
        payload.document = input.document;
        break;

      case 'location':
        payload.type = 'location';
        payload.location = input.location;
        break;

      case 'interactive':
        payload.type = 'interactive';
        payload.interactive = input.interactive;
        break;

      default:
        throw new MetaApiError(`Unsupported message type: ${(input as any).type}`, 400);
    }

    if (input.context) payload.context = input.context;

    return this.request<MetaMessageResponse>(`/${this.phoneNumberId}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async sendTextMessage(
    to: string,
    text: string,
    previewUrl: boolean = false,
    replyToMessageId?: string
  ): Promise<MetaMessageResponse> {
    return this.sendMessage({
      to,
      type: 'text',
      text: { body: text, preview_url: previewUrl },
      context: replyToMessageId ? { message_id: replyToMessageId } : undefined,
    } as any);
  }

  async sendTemplateMessage(
    to: string,
    templateName: string,
    languageCode: string,
    components?: any[]
  ): Promise<MetaMessageResponse> {
    return this.sendMessage({
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components,
      },
    } as any);
  }

  async sendImageMessage(to: string, imageUrl: string, caption?: string): Promise<MetaMessageResponse> {
    return this.sendMessage({
      to,
      type: 'image',
      image: { link: imageUrl, caption },
    } as any);
  }

  async sendVideoMessage(to: string, videoUrl: string, caption?: string): Promise<MetaMessageResponse> {
    return this.sendMessage({
      to,
      type: 'video',
      video: { link: videoUrl, caption },
    } as any);
  }

  async sendDocumentMessage(
    to: string,
    documentUrl: string,
    filename: string,
    caption?: string
  ): Promise<MetaMessageResponse> {
    return this.sendMessage({
      to,
      type: 'document',
      document: { link: documentUrl, filename, caption },
    } as any);
  }

  async sendLocationMessage(
    to: string,
    latitude: number,
    longitude: number,
    name?: string,
    address?: string
  ): Promise<MetaMessageResponse> {
    return this.sendMessage({
      to,
      type: 'location',
      location: { latitude, longitude, name, address },
    } as any);
  }

  // ✅ REQUIRED by whatsapp.service.ts
  async sendButtonMessage(
    to: string,
    bodyText: string,
    buttons: { id: string; title: string }[],
    headerText?: string,
    footerText?: string
  ): Promise<MetaMessageResponse> {
    return this.sendMessage({
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        header: headerText ? { type: 'text', text: headerText } : undefined,
        body: { text: bodyText },
        footer: footerText ? { text: footerText } : undefined,
        action: {
          buttons: buttons.map((btn) => ({
            type: 'reply' as const,
            reply: { id: btn.id, title: btn.title },
          })),
        },
      },
    } as any);
  }

  // ✅ REQUIRED by whatsapp.service.ts
  async sendListMessage(
    to: string,
    bodyText: string,
    buttonText: string,
    sections: { title?: string; rows: { id: string; title: string; description?: string }[] }[],
    headerText?: string,
    footerText?: string
  ): Promise<MetaMessageResponse> {
    return this.sendMessage({
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        header: headerText ? { type: 'text', text: headerText } : undefined,
        body: { text: bodyText },
        footer: footerText ? { text: footerText } : undefined,
        action: {
          button: buttonText,
          sections,
        },
      },
    } as any);
  }

  // ==========================================
  // MARK AS READ
  // ==========================================
  async markAsRead(messageId: string): Promise<boolean> {
    if (!this.phoneNumberId) return false;

    try {
      await this.request(`/${this.phoneNumberId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status: 'read',
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
  async uploadMedia(file: Buffer, mimeType: string, filename: string): Promise<{ id: string }> {
    if (!this.phoneNumberId) {
      throw new MetaApiError('phoneNumberId is required to upload media', 400);
    }

    // NOTE: Node 18+ supports global FormData/Blob via undici.
    // If TS types complain in your setup, tell me and I will provide a form-data package version.
    const formData: any = new (global as any).FormData();
    formData.append('messaging_product', 'whatsapp');

    const blob = new (global as any).Blob([file], { type: mimeType });
    formData.append('file', blob, filename);
    formData.append('type', mimeType);

    const res = await fetchWithTimeout(`${META_GRAPH_URL}/${this.phoneNumberId}/media`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      } as any,
      body: formData,
    }, 30000);

    const data: any = await safeJson(res);

    if (!res.ok) {
      const msg = data?.error?.message || 'Failed to upload media';
      throw new MetaApiError(msg, res.status, data?.error || data);
    }

    return data as { id: string };
  }

  async getMediaUrl(mediaId: string): Promise<MediaUrlResponse> {
    return this.request<MediaUrlResponse>(`/${mediaId}`);
  }

  async downloadMedia(mediaUrl: string): Promise<Buffer> {
    const res = await fetchWithTimeout(mediaUrl, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      } as any,
    }, 30000);

    if (!res.ok) {
      throw new MetaApiError('Failed to download media', res.status);
    }

    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  // ==========================================
  // TEMPLATE METHODS
  // ==========================================
  async getTemplates(wabaId?: string): Promise<MetaTemplateResponse[]> {
    const id = wabaId || this.wabaId;
    if (!id) throw new MetaApiError('WABA ID is required', 400);

    const data = await this.request<{ data: MetaTemplateResponse[] }>(
      `/${id}/message_templates?fields=id,name,status,category,language,components&limit=100`
    );

    return data.data || [];
  }

  async createTemplate(
    wabaId: string,
    name: string,
    language: string,
    category: string,
    components: any[]
  ): Promise<MetaTemplateResponse> {
    return this.request<MetaTemplateResponse>(`/${wabaId}/message_templates`, {
      method: 'POST',
      body: JSON.stringify({ name, language, category, components }),
    });
  }

  async deleteTemplate(wabaId: string, templateName: string): Promise<boolean> {
    try {
      await this.request(`/${wabaId}/message_templates?name=${encodeURIComponent(templateName)}`, {
        method: 'DELETE',
      });
      return true;
    } catch {
      return false;
    }
  }

  // ==========================================
  // PHONE NUMBER METHODS
  // ==========================================
  async getPhoneNumberInfo(): Promise<MetaPhoneNumber> {
    if (!this.phoneNumberId) throw new MetaApiError('phoneNumberId is required', 400);

    return this.request<MetaPhoneNumber>(
      `/${this.phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status`
    );
  }

  async requestVerificationCode(codeMethod: 'SMS' | 'VOICE'): Promise<boolean> {
    if (!this.phoneNumberId) return false;

    try {
      await this.request(`/${this.phoneNumberId}/request_code`, {
        method: 'POST',
        body: JSON.stringify({
          code_method: codeMethod,
          language: 'en',
        }),
      });
      return true;
    } catch {
      return false;
    }
  }

  async verifyCode(code: string): Promise<boolean> {
    if (!this.phoneNumberId) return false;

    try {
      await this.request(`/${this.phoneNumberId}/verify_code`, {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      return true;
    } catch {
      return false;
    }
  }

  // ==========================================
  // BUSINESS PROFILE
  // ==========================================
  async getBusinessProfile(): Promise<any> {
    if (!this.phoneNumberId) throw new MetaApiError('phoneNumberId is required', 400);

    return this.request(
      `/${this.phoneNumberId}/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites,vertical`
    );
  }

  async updateBusinessProfile(profileData: {
    about?: string;
    address?: string;
    description?: string;
    email?: string;
    websites?: string[];
    vertical?: string;
  }): Promise<boolean> {
    if (!this.phoneNumberId) return false;

    try {
      await this.request(`/${this.phoneNumberId}/whatsapp_business_profile`, {
        method: 'POST',
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          ...profileData,
        }),
      });
      return true;
    } catch {
      return false;
    }
  }
}