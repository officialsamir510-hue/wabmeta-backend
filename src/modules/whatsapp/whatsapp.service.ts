import prisma from "../../config/database";
import { config } from "../../config";
import { AppError } from "../../middleware/errorHandler";
import { whatsappApi } from "./whatsapp.api";

type MediaType = "image" | "video" | "audio" | "document";

export class WhatsAppService {
  // -----------------------------
  // CONNECT ACCOUNT (OAuth)
  // -----------------------------
  async connectAccount(organizationId: string, code: string, redirectUri: string) {
    if (!config.meta.appId || !config.meta.appSecret) {
      throw new AppError("Meta app credentials missing on server", 500);
    }

    const shortTokenRes = await whatsappApi.exchangeCodeForToken(code, redirectUri);
    const shortToken = shortTokenRes.access_token;

    let accessToken = shortToken;
    let tokenExpiresAt: Date | null = null;

    try {
      const longTokenRes = await whatsappApi.exchangeForLongLivedToken(shortToken);
      accessToken = longTokenRes.access_token;
      if (longTokenRes.expires_in) {
        tokenExpiresAt = new Date(Date.now() + longTokenRes.expires_in * 1000);
      }
    } catch {
      if (shortTokenRes.expires_in) {
        tokenExpiresAt = new Date(Date.now() + shortTokenRes.expires_in * 1000);
      }
    }

    const businesses = await whatsappApi.getUserBusinesses(accessToken);
    if (!businesses.length) throw new AppError("No Meta Business found for this user", 400);

    let waba: any = null;
    let phone: any = null;

    for (const b of businesses) {
      const wabas = await whatsappApi.getOwnedWabas(b.id, accessToken);
      if (!wabas.length) continue;

      for (const w of wabas) {
        const phones = await whatsappApi.getWabaPhoneNumbers(w.id, accessToken);
        if (phones.length) {
          waba = w;
          phone = phones[0];
          break;
        }
      }
      if (waba && phone) break;
    }

    if (!waba) throw new AppError("No WhatsApp Business Account (WABA) found", 400);
    if (!phone) throw new AppError("No WhatsApp phone number found under WABA", 400);

    try {
      await whatsappApi.subscribeAppToWaba(waba.id, accessToken);
    } catch (e) {
      console.error("Failed to subscribe app to WABA:", e);
    }

    const account = await prisma.whatsAppAccount.upsert({
      where: { phoneNumberId: String(phone.id) },
      update: {
        organizationId,
        wabaId: String(waba.id),
        phoneNumber: String(phone.display_phone_number || phone.phone_number || ""),
        displayName: String(phone.verified_name || phone.name || "WhatsApp"),
        accessToken,
        tokenExpiresAt,
        status: "CONNECTED",
        isDefault: true,
      },
      create: {
        organizationId,
        phoneNumberId: String(phone.id),
        wabaId: String(waba.id),
        phoneNumber: String(phone.display_phone_number || phone.phone_number || ""),
        displayName: String(phone.verified_name || phone.name || "WhatsApp"),
        accessToken,
        tokenExpiresAt,
        status: "CONNECTED",
        isDefault: true,
      },
    });

    return account;
  }

  // -----------------------------
  // WEBHOOK VERIFY
  // -----------------------------
  verifyWebhook(mode?: string, token?: string, challenge?: string) {
    if (mode === "subscribe" && token === config.meta.webhookVerifyToken) {
      return challenge || "";
    }
    throw new AppError("Webhook verification failed", 403);
  }

  // -----------------------------
  // WEBHOOK HANDLER (minimal)
  // -----------------------------
  async handleWebhook(_payload: any) {
    return true;
  }

  // -----------------------------
  // INTERNAL: get account by org + id
  // -----------------------------
  private async getAccount(organizationId: string, whatsappAccountId: string) {
    const account = await prisma.whatsAppAccount.findFirst({
      where: {
        id: whatsappAccountId,
        organizationId,
      },
    });

    if (!account) throw new AppError("WhatsApp account not found", 404);
    if (!account.accessToken) throw new AppError("WhatsApp account token missing", 400);
    if (!account.phoneNumberId) throw new AppError("WhatsApp phoneNumberId missing", 400);

    return account;
  }

  // =========================================================
  // ✅ METHODS USED BY inbox.service.ts (EXACT SIGNATURE MATCH)
  // =========================================================

  /**
   * inbox.service.ts calling:
   * sendTextMessage(organizationId, waAccount.id, toPhone, content, replyToMessageId)
   */
  async sendTextMessage(
    organizationId: string,
    whatsappAccountId: string,
    to: string,
    message: string,
    replyToMessageId?: string
  ) {
    if (!message) throw new AppError("Content is required for text messages", 400);

    const account = await this.getAccount(organizationId, whatsappAccountId);

    const payload: any = {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: {
        body: message,
        preview_url: false,
      },
    };

    if (replyToMessageId) {
      payload.context = { message_id: replyToMessageId };
    }

    return whatsappApi.sendMessage(account.phoneNumberId, account.accessToken, payload);
  }

  /**
   * inbox.service.ts calling:
   * sendMediaMessage(organizationId, waAccount.id, toPhone, type, mediaUrl, content, filename)
   */
  async sendMediaMessage(
    organizationId: string,
    whatsappAccountId: string,
    to: string,
    mediaType: MediaType,
    mediaUrl: string,
    caption?: string,
    filename?: string
  ) {
    if (!mediaUrl) throw new AppError("Media URL is required", 400);

    const account = await this.getAccount(organizationId, whatsappAccountId);

    const mediaObj: any = { link: mediaUrl };
    if (caption) mediaObj.caption = caption;
    if (filename && mediaType === "document") mediaObj.filename = filename;

    const payload: any = {
      messaging_product: "whatsapp",
      to,
      type: mediaType,
      [mediaType]: mediaObj,
    };

    return whatsappApi.sendMessage(account.phoneNumberId, account.accessToken, payload);
  }

  /**
   * inbox.service.ts calling:
   * sendInteractiveMessage(organizationId, waAccount.id, toPhone, interactive.type, content, {...})
   */
  async sendInteractiveMessage(
    organizationId: string,
    whatsappAccountId: string,
    to: string,
    interactiveType: string,
    bodyText: string,
    configObj: {
      buttons?: Array<{ id?: string; title?: string; text?: string }>;
      sections?: any[];
      buttonText?: string;
    }
  ) {
    if (!bodyText) throw new AppError("Body text required for interactive messages", 400);

    const account = await this.getAccount(organizationId, whatsappAccountId);

    const type = String(interactiveType || "").toLowerCase();

    let interactive: any;

    // Buttons
    if (type.includes("button") || (configObj?.buttons && configObj.buttons.length > 0)) {
      const buttons = (configObj.buttons || []).slice(0, 3).map((b, idx) => ({
        type: "reply",
        reply: {
          id: b.id || `btn_${idx + 1}`,
          title: b.title || b.text || `Button ${idx + 1}`,
        },
      }));

      interactive = {
        type: "button",
        body: { text: bodyText },
        action: { buttons },
      };
    }
    // List
    else if (type.includes("list") || (configObj?.sections && configObj.sections.length > 0)) {
      interactive = {
        type: "list",
        body: { text: bodyText },
        action: {
          button: configObj.buttonText || "Select",
          sections: configObj.sections || [],
        },
      };
    } else {
      throw new AppError("Invalid interactive payload", 400);
    }

    const payload: any = {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive,
    };

    return whatsappApi.sendMessage(account.phoneNumberId, account.accessToken, payload);
  }
}

export const whatsappService = new WhatsAppService();