import prisma from "../../config/database";
import { config } from "../../config";
import { AppError } from "../../middleware/errorHandler";
import { whatsappApi } from "./whatsapp.api";

type SendTextInput =
  | { whatsappAccountId: string; to: string; message: string; previewUrl?: boolean }
  | [string, string, string]; // (whatsappAccountId, to, message)

type SendMediaInput =
  | {
      whatsappAccountId: string;
      to: string;
      mediaType: "image" | "video" | "audio" | "document";
      mediaUrl: string;
      caption?: string;
      filename?: string;
    }
  | [string, string, string, string]; // (whatsappAccountId, to, mediaType, mediaUrl)

type SendInteractiveInput =
  | { whatsappAccountId: string; to: string; interactive: any }
  | [string, string, any]; // (whatsappAccountId, to, interactive)

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
      if (longTokenRes.expires_in) tokenExpiresAt = new Date(Date.now() + longTokenRes.expires_in * 1000);
    } catch {
      if (shortTokenRes.expires_in) tokenExpiresAt = new Date(Date.now() + shortTokenRes.expires_in * 1000);
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
  // INTERNAL HELPER: get account
  // -----------------------------
  private async getAccountById(whatsappAccountId: string) {
    const account = await prisma.whatsAppAccount.findUnique({
      where: { id: whatsappAccountId },
    });

    if (!account) throw new AppError("WhatsApp account not found", 404);
    if (!account.accessToken) throw new AppError("WhatsApp account token missing", 400);

    return account;
  }

  // -----------------------------
  // SEND TEXT MESSAGE ✅ (needed by inbox.service)
  // -----------------------------
  async sendTextMessage(input: any, toMaybe?: any, messageMaybe?: any) {
    // Support both signatures:
    // (whatsappAccountId, to, message)
    // ({ whatsappAccountId, to, message, previewUrl })
    const data: any =
      typeof input === "string"
        ? { whatsappAccountId: input, to: toMaybe, message: messageMaybe }
        : input;

    const { whatsappAccountId, to, message, previewUrl } = data as any;

    if (!whatsappAccountId || !to || !message) {
      throw new AppError("whatsappAccountId, to and message are required", 400);
    }

    const account = await this.getAccountById(whatsappAccountId);

    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: {
        body: message,
        preview_url: Boolean(previewUrl),
      },
    };

    return whatsappApi.sendMessage(account.phoneNumberId, account.accessToken, payload);
  }

  // -----------------------------
  // SEND MEDIA MESSAGE ✅ (needed by inbox.service)
  // -----------------------------
  async sendMediaMessage(input: any, toMaybe?: any, mediaTypeMaybe?: any, mediaUrlMaybe?: any) {
    // Support both:
    // (whatsappAccountId, to, mediaType, mediaUrl)
    // ({ whatsappAccountId, to, mediaType, mediaUrl, caption, filename })
    const data: any =
      typeof input === "string"
        ? {
            whatsappAccountId: input,
            to: toMaybe,
            mediaType: mediaTypeMaybe,
            mediaUrl: mediaUrlMaybe,
          }
        : input;

    const { whatsappAccountId, to, mediaType, mediaUrl, caption, filename } = data as any;

    if (!whatsappAccountId || !to || !mediaType || !mediaUrl) {
      throw new AppError("whatsappAccountId, to, mediaType and mediaUrl are required", 400);
    }

    const account = await this.getAccountById(whatsappAccountId);

    const mediaObj: any = { link: mediaUrl };
    if (caption) mediaObj.caption = caption;
    if (filename) mediaObj.filename = filename;

    const payload = {
      messaging_product: "whatsapp",
      to,
      type: mediaType, // image|video|audio|document
      [mediaType]: mediaObj,
    };

    return whatsappApi.sendMessage(account.phoneNumberId, account.accessToken, payload);
  }

  // -----------------------------
  // SEND INTERACTIVE MESSAGE ✅ (needed by inbox.service)
  // -----------------------------
  async sendInteractiveMessage(input: any, toMaybe?: any, interactiveMaybe?: any) {
    // Support both:
    // (whatsappAccountId, to, interactive)
    // ({ whatsappAccountId, to, interactive })
    const data: any =
      typeof input === "string"
        ? { whatsappAccountId: input, to: toMaybe, interactive: interactiveMaybe }
        : input;

    const { whatsappAccountId, to, interactive } = data as any;

    if (!whatsappAccountId || !to || !interactive) {
      throw new AppError("whatsappAccountId, to and interactive are required", 400);
    }

    const account = await this.getAccountById(whatsappAccountId);

    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive,
    };

    return whatsappApi.sendMessage(account.phoneNumberId, account.accessToken, payload);
  }
}

export const whatsappService = new WhatsAppService();