import prisma from "../../config/database";
import { config } from "../../config";
import { AppError } from "../../middleware/errorHandler";
import { whatsappApi } from "./whatsapp.api";

export class WhatsAppService {
  async connectAccount(organizationId: string, code: string, redirectUri: string) {
    if (!config.meta.appId || !config.meta.appSecret) {
      throw new AppError("Meta app credentials missing on server", 500);
    }

    // 1) code -> short-lived token
    const shortTokenRes = await whatsappApi.exchangeCodeForToken(code, redirectUri);
    const shortToken = shortTokenRes.access_token;

    // 2) short -> long-lived token (recommended)
    let accessToken = shortToken;
    let tokenExpiresAt: Date | null = null;

    try {
      const longTokenRes = await whatsappApi.exchangeForLongLivedToken(shortToken);
      accessToken = longTokenRes.access_token;
      if (longTokenRes.expires_in) {
        tokenExpiresAt = new Date(Date.now() + longTokenRes.expires_in * 1000);
      }
    } catch {
      // fallback: short token (still works but expires sooner)
      if (shortTokenRes.expires_in) {
        tokenExpiresAt = new Date(Date.now() + shortTokenRes.expires_in * 1000);
      }
    }

    // 3) Find WABA + phone number
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

    // 4) Subscribe app to WABA (required for webhook/messages)
    try {
      await whatsappApi.subscribeAppToWaba(waba.id, accessToken);
    } catch (e) {
      // not fatal in some cases, but better to log
      console.error("Failed to subscribe app to WABA:", e);
    }

    // 5) Upsert WhatsAppAccount in DB
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

  verifyWebhook(mode?: string, token?: string, challenge?: string) {
    if (mode === "subscribe" && token === config.meta.webhookVerifyToken) {
      return challenge || "";
    }
    throw new AppError("Webhook verification failed", 403);
  }

  // Minimal webhook handler (store later as needed)
  async handleWebhook(payload: any) {
    // Always accept quickly to stop retries
    // You can parse messages/statuses here later.
    return true;
  }
}

export const whatsappService = new WhatsAppService();