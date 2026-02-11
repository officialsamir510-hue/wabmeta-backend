// src/modules/whatsapp/whatsapp.service.ts

import prisma from "../../config/database";
import { config } from "../../config";
import { AppError } from "../../middleware/errorHandler";
import { whatsappApi } from "./whatsapp.api";
import { MessageType } from "@prisma/client";

export class WhatsAppService {
  getConnectionStatus: any;
  processWebhook: any;
  // ============================================
  // CONNECT ACCOUNT (OAuth)
  // ============================================
  async connectAccount(organizationId: string, code: string, redirectUri: string) {
    if (!config.meta.appId || !config.meta.appSecret) {
      throw new AppError("Meta app credentials missing on server", 500);
    }

    console.log("🔄 Exchanging OAuth code for token...");
    const shortTokenRes = await whatsappApi.exchangeCodeForToken(code, redirectUri);
    const shortToken = shortTokenRes.access_token;

    let accessToken = shortToken;
    let tokenExpiresAt: Date | null = null;

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

    // Verify token & permissions
    try {
      const me = await whatsappApi.getMe(accessToken);
      const debug = await whatsappApi.debugToken(accessToken);

      console.log("✅ META /me:", me);
      
      const scopes: string[] = debug?.data?.scopes || [];
      const requiredScopes = [
        "business_management",
        "whatsapp_business_management",
        "whatsapp_business_messaging",
      ];
      const hasRequiredScope = requiredScopes.some((scope) => scopes.includes(scope));

      if (!hasRequiredScope) {
        throw new AppError(
          `Meta token missing required permissions. Current scopes: [${scopes.join(", ")}].`,
          400
        );
      }
    } catch (e: any) {
      if (e instanceof AppError) throw e;
      throw new AppError(`Token validation failed: ${e?.message}`, 400);
    }

    // Fetch businesses & WABAs
    console.log("🔄 Fetching user businesses...");
    const businesses = await whatsappApi.getUserBusinesses(accessToken);
    
    if (!businesses.length) {
      throw new AppError("No Meta Business found for this user.", 400);
    }

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

    if (!waba || !phone) {
      throw new AppError("No WhatsApp Business Account or Phone Number found.", 400);
    }

    // Subscribe app to WABA webhooks
    try {
      await whatsappApi.subscribeAppToWaba(waba.id, accessToken);
      console.log("✅ App subscribed to WABA webhooks");
    } catch (e: any) {
      console.warn("⚠️ Failed to subscribe app to WABA:", e?.message);
    }

    // Upsert account in DB
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

  // ============================================
  // DISCONNECT ACCOUNT
  // ============================================
  async disconnectAccount(organizationId: string, accountId: string) {
    const account = await prisma.whatsAppAccount.findFirst({
      where: { id: accountId, organizationId },
    });

    if (!account) throw new AppError("WhatsApp account not found", 404);

    await prisma.whatsAppAccount.update({
      where: { id: accountId },
      data: {
        status: "DISCONNECTED",
        accessToken: null,
        tokenExpiresAt: null,
      },
    });

    return { message: "WhatsApp account disconnected successfully" };
  }

  // ============================================
  // GET ACCOUNTS (Updated for dual system)
  // ============================================
  async getAccounts(organizationId: string) {
    console.log('📱 Fetching WhatsApp accounts for org:', organizationId);

    // Check new MetaConnection system first
    const metaConnection = await prisma.metaConnection.findUnique({
      where: { organizationId },
      include: {
        phoneNumbers: {
          where: { isActive: true },
          orderBy: { isPrimary: 'desc' }
        }
      }
    });

    if (metaConnection && metaConnection.status === 'CONNECTED') {
      console.log('✅ Found Meta connection with', metaConnection.phoneNumbers.length, 'phone(s)');
      
      // Convert to WhatsApp account format for compatibility
      return metaConnection.phoneNumbers.map((phone, index) => ({
        id: phone.id,
        phoneNumber: phone.phoneNumber,
        displayName: phone.displayName || phone.verifiedName || 'WhatsApp',
        status: 'CONNECTED',
        isDefault: phone.isPrimary || index === 0,
        wabaId: metaConnection.wabaId,
        phoneNumberId: phone.phoneNumberId,
        tokenExpiresAt: metaConnection.accessTokenExpiresAt,
        qualityRating: phone.qualityRating,
        verifiedName: phone.verifiedName,
        createdAt: phone.createdAt,
        updatedAt: phone.updatedAt,
        // Additional meta info
        metaConnectionId: metaConnection.id,
        wabaName: metaConnection.wabaName,
        businessId: metaConnection.businessId,
      }));
    }

    // Fallback to old WhatsAppAccount table
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
        qualityRating: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log('✅ Accounts found (legacy):', accounts.length);
    return accounts;
  }

  // ============================================
  // GET SINGLE ACCOUNT
  // ============================================
  async getAccountById(organizationId: string, accountId: string) {
    // First check MetaConnection phone numbers
    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: { 
        id: accountId,
        metaConnection: { organizationId }
      },
      include: {
        metaConnection: true
      }
    });

    if (phoneNumber) {
      return {
        id: phoneNumber.id,
        phoneNumber: phoneNumber.phoneNumber,
        displayName: phoneNumber.displayName || phoneNumber.verifiedName || 'WhatsApp',
        status: phoneNumber.metaConnection.status,
        isDefault: phoneNumber.isPrimary,
        wabaId: phoneNumber.metaConnection.wabaId,
        phoneNumberId: phoneNumber.phoneNumberId,
        tokenExpiresAt: phoneNumber.metaConnection.accessTokenExpiresAt,
        qualityRating: phoneNumber.qualityRating,
        verifiedName: phoneNumber.verifiedName,
        createdAt: phoneNumber.createdAt,
        updatedAt: phoneNumber.updatedAt,
      };
    }

    // Fallback to WhatsAppAccount
    const account = await prisma.whatsAppAccount.findFirst({
      where: { id: accountId, organizationId },
    });

    if (!account) throw new AppError("WhatsApp account not found", 404);
    return account;
  }

  // ============================================
  // SET DEFAULT ACCOUNT
  // ============================================
  async setDefaultAccount(organizationId: string, accountId: string) {
    // Check if it's a PhoneNumber from MetaConnection
    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: { 
        id: accountId,
        metaConnection: { organizationId }
      },
      include: { metaConnection: true }
    });

    if (phoneNumber) {
      await prisma.$transaction([
        prisma.phoneNumber.updateMany({
          where: { metaConnectionId: phoneNumber.metaConnectionId },
          data: { isPrimary: false },
        }),
        prisma.phoneNumber.update({
          where: { id: accountId },
          data: { isPrimary: true },
        }),
      ]);

      return { message: "Default phone number updated successfully" };
    }

    // Fallback to WhatsAppAccount
    const account = await prisma.whatsAppAccount.findFirst({
      where: { id: accountId, organizationId },
    });

    if (!account) throw new AppError("WhatsApp account not found", 404);

    await prisma.$transaction([
      prisma.whatsAppAccount.updateMany({
        where: { organizationId },
        data: { isDefault: false },
      }),
      prisma.whatsAppAccount.update({
        where: { id: accountId },
        data: { isDefault: true },
      }),
    ]);

    return { message: "Default account updated successfully" };
  }

  // ============================================
  // GET VALID ACCOUNT (Internal helper)
  // ============================================
  private async getAccount(organizationId: string, whatsappAccountId: string) {
    // First try to find in PhoneNumber (new system)
    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: { 
        OR: [
          { id: whatsappAccountId },
          { phoneNumberId: whatsappAccountId }
        ],
        metaConnection: { 
          organizationId,
          status: 'CONNECTED'
        }
      },
      include: { metaConnection: true }
    });

    if (phoneNumber && phoneNumber.metaConnection.accessToken) {
      // Check expiry
      if (phoneNumber.metaConnection.accessTokenExpiresAt && 
          phoneNumber.metaConnection.accessTokenExpiresAt < new Date()) {
        throw new AppError("WhatsApp access token has expired. Please reconnect.", 400);
      }

      return {
        id: phoneNumber.id,
        phoneNumberId: phoneNumber.phoneNumberId,
        accessToken: phoneNumber.metaConnection.accessToken,
        wabaId: phoneNumber.metaConnection.wabaId,
        phoneNumber: phoneNumber.phoneNumber,
        displayName: phoneNumber.displayName,
      };
    }

    // Fallback to WhatsAppAccount
    const account = await prisma.whatsAppAccount.findFirst({
      where: { 
        OR: [
          { id: whatsappAccountId },
          { phoneNumberId: whatsappAccountId }
        ],
        organizationId 
      },
    });

    if (!account) throw new AppError("WhatsApp account not found", 404);
    if (!account.accessToken) throw new AppError("WhatsApp account token missing. Please reconnect.", 400);
    
    if (account.tokenExpiresAt && account.tokenExpiresAt < new Date()) {
      throw new AppError("WhatsApp access token has expired. Please reconnect.", 400);
    }

    return {
      id: account.id,
      phoneNumberId: account.phoneNumberId,
      accessToken: account.accessToken,
      wabaId: account.wabaId,
      phoneNumber: account.phoneNumber,
      displayName: account.displayName,
    };
  }

  // ============================================
  // MESSAGING METHODS
  // ============================================

  async sendTextMessage(
    organizationId: string, 
    whatsappAccountId: string, 
    to: string, 
    message: string, 
    replyToMessageId?: string
  ) {
    const account = await this.getAccount(organizationId, whatsappAccountId);
    
    const payload: any = {
      messaging_product: "whatsapp",
      to: this.formatPhoneNumber(to),
      type: "text",
      text: { body: message, preview_url: true },
    };
    
    if (replyToMessageId) {
      payload.context = { message_id: replyToMessageId };
    }

    const result = await whatsappApi.sendMessage(
      account.phoneNumberId, 
      account.accessToken, 
      payload
    );
    
    return result;
  }

  async sendMediaMessage(
    organizationId: string, 
    whatsappAccountId: string, 
    to: string, 
    mediaType: string, 
    mediaUrl: string, 
    caption?: string, 
    filename?: string
  ) {
    const account = await this.getAccount(organizationId, whatsappAccountId);
    const type = mediaType.toLowerCase();
    
    const mediaObj: any = { link: mediaUrl };
    if (caption) mediaObj.caption = caption;
    if (filename && type === "document") mediaObj.filename = filename;

    const payload = {
      messaging_product: "whatsapp",
      to: this.formatPhoneNumber(to),
      type,
      [type]: mediaObj,
    };

    const result = await whatsappApi.sendMessage(
      account.phoneNumberId, 
      account.accessToken, 
      payload
    );
    
    return result;
  }

  async sendTemplateMessage(
    organizationId: string,
    whatsappAccountId: string,
    to: string,
    templateName: string,
    languageCode: string,
    components?: any[]
  ) {
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
    
    if (components?.length) {
      payload.template.components = components;
    }

    const result = await whatsappApi.sendMessage(
      account.phoneNumberId, 
      account.accessToken, 
      payload
    );
    
    return result;
  }

  async sendInteractiveMessage(
    organizationId: string,
    whatsappAccountId: string,
    to: string,
    interactiveType: 'button' | 'list',
    bodyText: string,
    configObj: {
      headerText?: string;
      footerText?: string;
      buttons?: Array<{ id: string; title: string }>;
      sections?: Array<{
        title: string;
        rows: Array<{ id: string; title: string; description?: string }>;
      }>;
      buttonText?: string;
    }
  ) {
    const account = await this.getAccount(organizationId, whatsappAccountId);
    
    const interactive: any = {
      type: interactiveType,
      body: { text: bodyText },
    };

    if (configObj.headerText) {
      interactive.header = { type: 'text', text: configObj.headerText };
    }

    if (configObj.footerText) {
      interactive.footer = { text: configObj.footerText };
    }

    if (interactiveType === 'button' && configObj.buttons) {
      interactive.action = {
        buttons: configObj.buttons.slice(0, 3).map(btn => ({
          type: 'reply',
          reply: { id: btn.id, title: btn.title.substring(0, 20) }
        }))
      };
    }

    if (interactiveType === 'list' && configObj.sections) {
      interactive.action = {
        button: configObj.buttonText || 'Select Option',
        sections: configObj.sections.map(section => ({
          title: section.title,
          rows: section.rows.map(row => ({
            id: row.id,
            title: row.title.substring(0, 24),
            description: row.description?.substring(0, 72)
          }))
        }))
      };
    }

    const payload = {
      messaging_product: "whatsapp",
      to: this.formatPhoneNumber(to),
      type: "interactive",
      interactive,
    };

    const result = await whatsappApi.sendMessage(
      account.phoneNumberId, 
      account.accessToken, 
      payload
    );
    
    return result;
  }

  async markMessageAsRead(
    organizationId: string, 
    whatsappAccountId: string, 
    messageId: string
  ) {
    const account = await this.getAccount(organizationId, whatsappAccountId);
    return whatsappApi.markAsRead(account.phoneNumberId, account.accessToken, messageId);
  }

  // ============================================
  // TEMPLATE METHODS
  // ============================================

  async getTemplates(whatsappAccountId: string, organizationId: string) {
    const account = await this.getAccount(organizationId, whatsappAccountId);
    
    try {
      const templates = await whatsappApi.getMessageTemplate(
        account.wabaId, 
        account.accessToken
      );
      
      return templates.data || [];
    } catch (error: any) {
      console.error('❌ Failed to fetch templates:', error);
      throw new AppError(error.message || 'Failed to fetch templates', 500);
    }
  }

  async syncTemplates(whatsappAccountId: string, organizationId: string) {
    const account = await this.getAccount(organizationId, whatsappAccountId);
    
    try {
      console.log('🔄 Syncing templates for WABA:', account.wabaId);
      
      const templates = await whatsappApi.getMessageTemplate(
        account.wabaId, 
        account.accessToken
      );

      const templateData = templates.data || [];
      let synced = 0;
      let failed = 0;

      for (const template of templateData) {
        try {
          await prisma.template.upsert({
            where: {
              organizationId_name_language: {
                organizationId,
                name: template.name,
                language: template.language,
              }
            },
            update: {
              metaTemplateId: template.id,
              category: this.mapTemplateCategory(template.category),
              status: this.mapTemplateStatus(template.status),
              bodyText: this.extractBodyText(template.components),
              headerType: this.extractHeaderType(template.components),
              headerContent: this.extractHeaderContent(template.components),
              footerText: this.extractFooterText(template.components),
              buttons: this.extractButtons(template.components),
              updatedAt: new Date(),
            },
            create: {
              organizationId,
              metaTemplateId: template.id,
              name: template.name,
              language: template.language,
              category: this.mapTemplateCategory(template.category),
              status: this.mapTemplateStatus(template.status),
              bodyText: this.extractBodyText(template.components),
              headerType: this.extractHeaderType(template.components),
              headerContent: this.extractHeaderContent(template.components),
              footerText: this.extractFooterText(template.components),
              buttons: this.extractButtons(template.components),
              variables: this.extractVariables(template.components),
            },
          });
          synced++;
        } catch (err) {
          console.error(`Failed to sync template ${template.name}:`, err);
          failed++;
        }
      }

      console.log(`✅ Synced ${synced} templates, ${failed} failed`);

      return {
        total: templateData.length,
        synced,
        failed,
        templates: templateData,
      };
    } catch (error: any) {
      console.error('❌ Template sync error:', error);
      throw new AppError(error.message || 'Failed to sync templates', 500);
    }
  }

  // Template helper methods
  private mapTemplateCategory(category: string): 'MARKETING' | 'UTILITY' | 'AUTHENTICATION' {
    const map: Record<string, 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'> = {
      'MARKETING': 'MARKETING',
      'UTILITY': 'UTILITY',
      'AUTHENTICATION': 'AUTHENTICATION',
    };
    return map[category?.toUpperCase()] || 'MARKETING';
  }

  private mapTemplateStatus(status: string): 'PENDING' | 'APPROVED' | 'REJECTED' {
    const map: Record<string, 'PENDING' | 'APPROVED' | 'REJECTED'> = {
      'APPROVED': 'APPROVED',
      'REJECTED': 'REJECTED',
      'PENDING': 'PENDING',
      'IN_APPEAL': 'PENDING',
      'PENDING_DELETION': 'APPROVED',
      'DELETED': 'REJECTED',
      'DISABLED': 'REJECTED',
    };
    return map[status?.toUpperCase()] || 'PENDING';
  }

  private extractBodyText(components: any[]): string {
    const body = components?.find(c => c.type === 'BODY');
    return body?.text || '';
  }

  private extractHeaderType(components: any[]): string | null {
    const header = components?.find(c => c.type === 'HEADER');
    return header?.format?.toLowerCase() || null;
  }

  private extractHeaderContent(components: any[]): string | null {
    const header = components?.find(c => c.type === 'HEADER');
    return header?.text || header?.example?.header_handle?.[0] || null;
  }

  private extractFooterText(components: any[]): string | null {
    const footer = components?.find(c => c.type === 'FOOTER');
    return footer?.text || null;
  }

  private extractButtons(components: any[]): any[] {
    const buttons = components?.find(c => c.type === 'BUTTONS');
    return buttons?.buttons || [];
  }

  private extractVariables(components: any[]): any[] {
    const variables: any[] = [];
    const body = components?.find(c => c.type === 'BODY');
    
    if (body?.example?.body_text?.[0]) {
      body.example.body_text[0].forEach((val: string, idx: number) => {
        variables.push({ index: idx + 1, example: val });
      });
    }
    
    return variables;
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  private formatPhoneNumber(phone: string): string {
    let cleaned = phone.replace(/[^\d]/g, "");
    
    // Remove leading zeros
    cleaned = cleaned.replace(/^0+/, '');
    
    // Add country code if missing (assuming Indian numbers)
    if (cleaned.length === 10) {
      cleaned = '91' + cleaned;
    }
    
    return cleaned;
  }
}

export const whatsappService = new WhatsAppService();