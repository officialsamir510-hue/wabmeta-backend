// src/modules/whatsapp/whatsapp.service.ts

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

    // Step 1: Exchange code for short-lived token
    console.log("🔄 Exchanging OAuth code for token...");
    const shortTokenRes = await whatsappApi.exchangeCodeForToken(code, redirectUri);
    const shortToken = shortTokenRes.access_token;

    let accessToken = shortToken;
    let tokenExpiresAt: Date | null = null;

    // Step 2: Try to get long-lived token
    try {
      console.log("🔄 Exchanging for long-lived token...");
      const longTokenRes = await whatsappApi.exchangeForLongLivedToken(shortToken);
      accessToken = longTokenRes.access_token;
      if (longTokenRes.expires_in) {
        tokenExpiresAt = new Date(Date.now() + longTokenRes.expires_in * 1000);
        console.log("✅ Got long-lived token, expires:", tokenExpiresAt);
      }
    } catch (e: any) {
      console.warn("⚠️ Could not get long-lived token, using short-lived:", e?.message);
      if (shortTokenRes.expires_in) {
        tokenExpiresAt = new Date(Date.now() + shortTokenRes.expires_in * 1000);
      }
    }

    // Step 3: Debug token and verify permissions
    try {
      const me = await whatsappApi.getMe(accessToken);
      const debug = await whatsappApi.debugToken(accessToken);

      console.log("✅ META /me:", me);
      console.log("✅ META debug_token summary:", {
        is_valid: debug?.data?.is_valid,
        user_id: debug?.data?.user_id,
        scopes: debug?.data?.scopes,
        expires_at: debug?.data?.expires_at,
      });

      const scopes: string[] = debug?.data?.scopes || [];

      // Check required permissions
      const requiredScopes = [
        "business_management",
        "whatsapp_business_management",
        "whatsapp_business_messaging",
      ];
      const hasRequiredScope = requiredScopes.some((scope) => scopes.includes(scope));

      if (!hasRequiredScope) {
        console.error("❌ Missing required scopes. Current scopes:", scopes);
        console.error("❌ Required at least one of:", requiredScopes);
        throw new AppError(
          `Meta token missing required permissions. Current scopes: [${scopes.join(", ")}]. ` +
            `Required: business_management or whatsapp_business_management. ` +
            `Ensure user is admin/tester and app has advanced access.`,
          400
        );
      }

      console.log("✅ Token permissions verified:", scopes);
    } catch (e: any) {
      console.error("❌ META token debug failed:", e?.message || e);

      // Re-throw AppError as-is, wrap others
      if (e instanceof AppError) {
        throw e;
      }
      throw new AppError(
        `Token validation failed. Check server logs for details. Error: ${e?.message || "Unknown error"}`,
        400
      );
    }

    // Step 4: Fetch businesses and WABAs
    console.log("🔄 Fetching user businesses...");
    const businesses = await whatsappApi.getUserBusinesses(accessToken);
    
    if (!businesses.length) {
      throw new AppError(
        "No Meta Business found for this user. Ensure the user has access to a Business Manager account.",
        400
      );
    }

    console.log(
      "✅ Found businesses:",
      businesses.map((b: { id: string; name: string }) => ({ id: b.id, name: b.name }))
    );

    let waba: any = null;
    let phone: any = null;

    for (const b of businesses) {
      console.log(`🔍 Checking business: ${b.name} (${b.id})`);

      const wabas = await whatsappApi.getOwnedWabas(b.id, accessToken);
      console.log(`   Found ${wabas.length} WABAs`);

      if (!wabas.length) continue;

      for (const w of wabas) {
        console.log(`   🔍 Checking WABA: ${w.name || w.id} (${w.id})`);

        const phones = await whatsappApi.getWabaPhoneNumbers(w.id, accessToken);
        console.log(`      Found ${phones.length} phone numbers`);

        if (phones.length) {
          waba = w;
          phone = phones[0];
          console.log(`   ✅ Selected phone: ${phone.display_phone_number || phone.id}`);
          break;
        }
      }
      if (waba && phone) break;
    }

    if (!waba) {
      throw new AppError(
        "No WhatsApp Business Account (WABA) found. " +
          "Create a WABA in Meta Business Manager and add a phone number.",
        400
      );
    }
    if (!phone) {
      throw new AppError(
        "No WhatsApp phone number found under WABA. " +
          "Add and verify a phone number in your WhatsApp Business Account.",
        400
      );
    }

    // Step 5: Subscribe app to WABA webhooks
    try {
      await whatsappApi.subscribeAppToWaba(waba.id, accessToken);
      console.log("✅ App subscribed to WABA webhooks");
    } catch (e: any) {
      console.warn("⚠️ Failed to subscribe app to WABA (non-blocking):", e?.message || e);
      // Don't throw - this is non-blocking, webhooks might already be set up
    }

    // Step 6: Upsert account in database
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

    console.log("✅ WhatsApp account connected successfully:", {
      id: account.id,
      phone: account.phoneNumber,
      displayName: account.displayName,
      wabaId: account.wabaId,
    });

    return account;
  }

  // -----------------------------
  // DISCONNECT ACCOUNT
  // -----------------------------
  async disconnectAccount(organizationId: string, accountId: string) {
    const account = await prisma.whatsAppAccount.findFirst({
      where: {
        id: accountId,
        organizationId,
      },
    });

    if (!account) {
      throw new AppError("WhatsApp account not found", 404);
    }

    await prisma.whatsAppAccount.update({
      where: { id: accountId },
      data: {
        status: "DISCONNECTED",
        accessToken: undefined,
        tokenExpiresAt: undefined,
      },
    });

    console.log("✅ WhatsApp account disconnected:", accountId);

    return { message: "WhatsApp account disconnected successfully" };
  }

  // -----------------------------
  // GET ACCOUNTS
  // -----------------------------
  async getAccounts(organizationId: string) {
    const accounts = await prisma.whatsAppAccount.findMany({
      where: { organizationId },
      select: {
        id: true,
        phoneNumber: true,
        displayName: true,
        status: true,
        isDefault: true,
        wabaId: true,
        phoneNumberId: true,
        tokenExpiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return accounts;
  }

  // -----------------------------
  // GET SINGLE ACCOUNT
  // -----------------------------
  async getAccountById(organizationId: string, accountId: string) {
    const account = await prisma.whatsAppAccount.findFirst({
      where: {
        id: accountId,
        organizationId,
      },
      select: {
        id: true,
        phoneNumber: true,
        displayName: true,
        status: true,
        isDefault: true,
        wabaId: true,
        phoneNumberId: true,
        tokenExpiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!account) {
      throw new AppError("WhatsApp account not found", 404);
    }

    return account;
  }

  // -----------------------------
  // SET DEFAULT ACCOUNT
  // -----------------------------
  async setDefaultAccount(organizationId: string, accountId: string) {
    const account = await prisma.whatsAppAccount.findFirst({
      where: {
        id: accountId,
        organizationId,
      },
    });

    if (!account) {
      throw new AppError("WhatsApp account not found", 404);
    }

    // Remove default from all accounts
    await prisma.whatsAppAccount.updateMany({
      where: { organizationId },
      data: { isDefault: false },
    });

    // Set new default
    await prisma.whatsAppAccount.update({
      where: { id: accountId },
      data: { isDefault: true },
    });

    return { message: "Default account updated successfully" };
  }

  // -----------------------------
  // WEBHOOK VERIFY
  // -----------------------------
  verifyWebhook(mode?: string, token?: string, challenge?: string) {
    console.log("🔍 Webhook verification:", { mode, token: token?.slice(0, 10) + "..." });

    if (mode === "subscribe" && token === config.meta.webhookVerifyToken) {
      console.log("✅ Webhook verified successfully");
      return challenge || "";
    }

    console.error("❌ Webhook verification failed");
    throw new AppError("Webhook verification failed", 403);
  }

  // -----------------------------
  // WEBHOOK HANDLER
  // -----------------------------
  async handleWebhook(payload: any) {
    console.log("📥 Webhook received:", JSON.stringify(payload, null, 2));

    // TODO: Process incoming messages, status updates, etc.
    // This will be expanded in the webhook handler module

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
    if (!account.accessToken) throw new AppError("WhatsApp account token missing. Please reconnect.", 400);
    if (!account.phoneNumberId) throw new AppError("WhatsApp phoneNumberId missing", 400);

    // Check token expiry
    if (account.tokenExpiresAt && account.tokenExpiresAt < new Date()) {
      throw new AppError("WhatsApp access token has expired. Please reconnect the account.", 400);
    }

    return account;
  }

  // =========================================================
  // ✅ MESSAGING METHODS (Used by inbox.service.ts)
  // =========================================================

  /**
   * Send text message
   * Called by: inbox.service.ts
   */
  async sendTextMessage(
    organizationId: string,
    whatsappAccountId: string,
    to: string,
    message: string,
    replyToMessageId?: string
  ) {
    if (!message) throw new AppError("Content is required for text messages", 400);
    if (!to) throw new AppError("Recipient phone number is required", 400);

    const account = await this.getAccount(organizationId, whatsappAccountId);

    const payload: any = {
      messaging_product: "whatsapp",
      to: this.formatPhoneNumber(to),
      type: "text",
      text: {
        body: message,
        preview_url: true,
      },
    };

    if (replyToMessageId) {
      payload.context = { message_id: replyToMessageId };
    }

    console.log("📤 Sending text message:", { to, messageLength: message.length });

    const result = await whatsappApi.sendMessage(account.phoneNumberId, account.accessToken, payload);

    console.log("✅ Message sent:", result?.messages?.[0]?.id);

    return result;
  }

  /**
   * Send media message (image, video, audio, document)
   * Called by: inbox.service.ts
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
    if (!to) throw new AppError("Recipient phone number is required", 400);

    const account = await this.getAccount(organizationId, whatsappAccountId);

    const mediaObj: any = { link: mediaUrl };
    if (caption) mediaObj.caption = caption;
    if (filename && mediaType === "document") mediaObj.filename = filename;

    const payload: any = {
      messaging_product: "whatsapp",
      to: this.formatPhoneNumber(to),
      type: mediaType,
      [mediaType]: mediaObj,
    };

    console.log("📤 Sending media message:", { to, mediaType, mediaUrl });

    const result = await whatsappApi.sendMessage(account.phoneNumberId, account.accessToken, payload);

    console.log("✅ Media message sent:", result?.messages?.[0]?.id);

    return result;
  }

  /**
   * Send interactive message (buttons, lists)
   * Called by: inbox.service.ts
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
      headerText?: string;
      footerText?: string;
    }
  ) {
    if (!bodyText) throw new AppError("Body text required for interactive messages", 400);
    if (!to) throw new AppError("Recipient phone number is required", 400);

    const account = await this.getAccount(organizationId, whatsappAccountId);

    const type = String(interactiveType || "").toLowerCase();

    let interactive: any;

    // Buttons (max 3)
    if (type.includes("button") || (configObj?.buttons && configObj.buttons.length > 0)) {
      const buttons = (configObj.buttons || []).slice(0, 3).map((b, idx) => ({
        type: "reply",
        reply: {
          id: b.id || `btn_${idx + 1}`,
          title: String(b.title || b.text || `Button ${idx + 1}`).slice(0, 20), // Max 20 chars
        },
      }));

      interactive = {
        type: "button",
        body: { text: bodyText },
        action: { buttons },
      };

      if (configObj.headerText) {
        interactive.header = { type: "text", text: configObj.headerText };
      }
      if (configObj.footerText) {
        interactive.footer = { text: configObj.footerText };
      }
    }
    // List (max 10 sections, 10 rows per section)
    else if (type.includes("list") || (configObj?.sections && configObj.sections.length > 0)) {
      interactive = {
        type: "list",
        body: { text: bodyText },
        action: {
          button: String(configObj.buttonText || "Select").slice(0, 20),
          sections: configObj.sections || [],
        },
      };

      if (configObj.headerText) {
        interactive.header = { type: "text", text: configObj.headerText };
      }
      if (configObj.footerText) {
        interactive.footer = { text: configObj.footerText };
      }
    } else {
      throw new AppError("Invalid interactive payload. Provide buttons or sections.", 400);
    }

    const payload: any = {
      messaging_product: "whatsapp",
      to: this.formatPhoneNumber(to),
      type: "interactive",
      interactive,
    };

    console.log("📤 Sending interactive message:", { to, type: interactive.type });

    const result = await whatsappApi.sendMessage(account.phoneNumberId, account.accessToken, payload);

    console.log("✅ Interactive message sent:", result?.messages?.[0]?.id);

    return result;
  }

  /**
   * Send template message
   * For campaigns and proactive messaging
   */
  async sendTemplateMessage(
    organizationId: string,
    whatsappAccountId: string,
    to: string,
    templateName: string,
    languageCode: string,
    components?: any[]
  ) {
    if (!templateName) throw new AppError("Template name is required", 400);
    if (!to) throw new AppError("Recipient phone number is required", 400);

    const account = await this.getAccount(organizationId, whatsappAccountId);

    const payload: any = {
      messaging_product: "whatsapp",
      to: this.formatPhoneNumber(to),
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode || "en_US" },
      },
    };

    if (components && components.length > 0) {
      payload.template.components = components;
    }

    console.log("📤 Sending template message:", { to, templateName, languageCode });

    const result = await whatsappApi.sendMessage(account.phoneNumberId, account.accessToken, payload);

    console.log("✅ Template message sent:", result?.messages?.[0]?.id);

    return result;
  }

  /**
   * Mark message as read
   */
  async markMessageAsRead(
    organizationId: string,
    whatsappAccountId: string,
    messageId: string
  ) {
    const account = await this.getAccount(organizationId, whatsappAccountId);

    const result = await whatsappApi.markAsRead(
      account.phoneNumberId,
      account.accessToken,
      messageId
    );

    return result;
  }

  // -----------------------------
  // UTILITY METHODS
  // -----------------------------

  /**
   * Format phone number for WhatsApp API
   * Removes '+', spaces, dashes, and validates
   */
  private formatPhoneNumber(phone: string): string {
    // Remove all non-numeric characters except leading +
    let cleaned = phone.replace(/[^\d+]/g, "");

    // Remove leading + if present
    if (cleaned.startsWith("+")) {
      cleaned = cleaned.slice(1);
    }

    // Validate length (minimum 10 digits for most countries)
    if (cleaned.length < 10) {
      throw new AppError(`Invalid phone number: ${phone}`, 400);
    }

    return cleaned;
  }

  /**
   * Check if account token is still valid
   */
  async checkAccountHealth(organizationId: string, accountId: string) {
    const account = await prisma.whatsAppAccount.findFirst({
      where: {
        id: accountId,
        organizationId,
      },
    });

    if (!account) {
      return { healthy: false, reason: "Account not found" };
    }

    if (account.status !== "CONNECTED") {
      return { healthy: false, reason: `Account status: ${account.status}` };
    }

    if (!account.accessToken) {
      return { healthy: false, reason: "No access token" };
    }

    if (account.tokenExpiresAt && account.tokenExpiresAt < new Date()) {
      return { healthy: false, reason: "Token expired" };
    }

    // Optional: Verify with Meta API
    try {
      await whatsappApi.getMe(account.accessToken);
      return { healthy: true, reason: "OK" };
    } catch (e: any) {
      return { healthy: false, reason: `API check failed: ${e?.message}` };
    }
  }
}

export const whatsappService = new WhatsAppService();