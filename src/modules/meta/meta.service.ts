// src/modules/meta/meta.service.ts

import { PrismaClient } from "@prisma/client";
import { MetaGraphAPI } from "./meta.api";
import { EncryptionUtil } from "../../utils/encryption";

const prisma = new PrismaClient();

export class MetaService {
  // ✅ helper (token masking)
  static maskSecret(value?: string | null, start = 10, end = 6) {
    if (!value) return null;
    const v = String(value);
    if (v.length <= start + end) return "***";
    return `${v.slice(0, start)}...${v.slice(-end)}`;
  }

  /**
   * Generate OAuth authorization URL
   */
  static getAuthorizationUrl(organizationId: string, userId: string): string {
    const configId = process.env.META_CONFIG_ID;
    const appId = process.env.META_APP_ID;
    const redirectUri = process.env.META_REDIRECT_URI;
    const version = process.env.META_GRAPH_API_VERSION || "v21.0";

    if (!configId || !appId || !redirectUri) {
      console.error("Missing Meta configuration:", {
        configId: !!configId,
        appId: !!appId,
        redirectUri: !!redirectUri,
      });
      throw new Error("WhatsApp Business integration not properly configured");
    }

    const state = Buffer.from(
      JSON.stringify({
        organizationId,
        userId,
        timestamp: Date.now(),
      })
    ).toString("base64");

    const params = new URLSearchParams({
      client_id: appId,
      config_id: configId,
      response_type: "code",
      override_default_response_type: "true",
      state,
      redirect_uri: redirectUri,
      scope: "business_management,whatsapp_business_management,whatsapp_business_messaging",
    });

    const authUrl = `https://www.facebook.com/${version}/dialog/oauth?${params.toString()}`;
    console.log("Generated auth URL for org:", organizationId);
    return authUrl;
  }

  /**
   * Handle OAuth callback and store connection
   */
  static async handleOAuthCallback(code: string, state: string) {
    let organizationId: string | undefined;
    let userId: string | undefined;

    try {
      const stateData = JSON.parse(Buffer.from(state, "base64").toString());
      organizationId = stateData.organizationId;
      userId = stateData.userId;

      if (!organizationId) throw new Error("Organization ID not found in state");
      console.log("OAuth callback for org:", organizationId);

      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        include: { metaConnection: true },
      });

      if (!organization) throw new Error("Organization not found");

      const api = new MetaGraphAPI();

      const tokenResponse = await api.exchangeCodeForToken(code);
      console.log("Token exchanged successfully");

      const longLivedToken = await api.getLongLivedToken(tokenResponse.access_token);

      const wabas = await api.getAccessibleWABAs(longLivedToken.access_token);
      if (!wabas || wabas.length === 0) {
        throw new Error("No WhatsApp Business Account found. Please ensure you are admin of a WABA.");
      }

      console.log(`Found ${wabas.length} WABAs`);

      const selectedWaba = wabas[0];
      console.log(`Selected WABA: ${selectedWaba.name} (${selectedWaba.id})`);

      const phoneNumbers = await api.getPhoneNumbers(selectedWaba.id, longLivedToken.access_token);
      if (!phoneNumbers || phoneNumbers.length === 0) {
        throw new Error("No phone numbers found in your WhatsApp Business Account.");
      }

      console.log(`Found ${phoneNumbers.length} phone numbers`);

      const encryptedToken = EncryptionUtil.encrypt(longLivedToken.access_token);

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 60);

      const metaConnection = await prisma.metaConnection.upsert({
        where: { organizationId },
        create: {
          organizationId,
          accessToken: encryptedToken,
          accessTokenExpiresAt: expiresAt,
          wabaId: selectedWaba.id,
          wabaName: selectedWaba.name || "WhatsApp Business Account",
          status: "CONNECTED",
          lastSyncedAt: new Date(),
          messagingLimit: phoneNumbers[0]?.messaging_limit_tier || "TIER_1",
          qualityRating: phoneNumbers[0]?.quality_rating || "UNKNOWN",
          errorMessage: null,
          webhookVerified: true,
        },
        update: {
          accessToken: encryptedToken,
          accessTokenExpiresAt: expiresAt,
          wabaId: selectedWaba.id,
          wabaName: selectedWaba.name || "WhatsApp Business Account",
          status: "CONNECTED",
          lastSyncedAt: new Date(),
          messagingLimit: phoneNumbers[0]?.messaging_limit_tier || "TIER_1",
          qualityRating: phoneNumbers[0]?.quality_rating || "UNKNOWN",
          errorMessage: null,
          webhookVerified: true,
        },
      });

      for (const phone of phoneNumbers) {
        await prisma.phoneNumber.upsert({
          where: { phoneNumberId: phone.id },
          create: {
            metaConnectionId: metaConnection.id,
            phoneNumberId: phone.id,
            phoneNumber: phone.display_phone_number,
            displayName: phone.display_phone_number,
            verifiedName: phone.verified_name || phone.display_phone_number,
            qualityRating: phone.quality_rating || "UNKNOWN",
            isActive: true,
            isPrimary: phoneNumbers.indexOf(phone) === 0,
          },
          update: {
            phoneNumber: phone.display_phone_number,
            displayName: phone.display_phone_number,
            verifiedName: phone.verified_name || phone.display_phone_number,
            qualityRating: phone.quality_rating || "UNKNOWN",
            isActive: true,
          },
        });
      }

      await prisma.activityLog.create({
        data: {
          organizationId,
          userId,
          action: "META_CONNECTED",
          entity: "MetaConnection",
          entityId: metaConnection.id,
          metadata: {
            wabaName: selectedWaba.name,
            wabaId: selectedWaba.id,
            phoneNumbers: phoneNumbers.map((p: any) => ({
              phoneNumberId: p.id,
              number: p.display_phone_number,
              verifiedName: p.verified_name,
              quality: p.quality_rating,
            })),
          },
        },
      });

      console.log("✅ Meta connection established for org:", organization.name);

      return {
        success: true,
        connection: {
          id: metaConnection.id,
          wabaId: metaConnection.wabaId,
          wabaName: metaConnection.wabaName,
          status: metaConnection.status,
        },
        phoneNumbers: phoneNumbers.map((p: any) => ({
          id: p.id,
          phoneNumberId: p.id,
          number: p.display_phone_number,
          verified: p.verified_name,
          quality: p.quality_rating,
        })),
      };
    } catch (error: any) {
      console.error("OAuth callback error:", error);

      if (organizationId && userId) {
        try {
          await prisma.activityLog.create({
            data: {
              organizationId,
              userId,
              action: "META_CONNECTION_FAILED",
              entity: "MetaConnection",
              metadata: { error: error.message, timestamp: new Date().toISOString() },
            },
          });
        } catch (logError) {
          console.error("Failed to log activity:", logError);
        }
      }

      throw new Error(error.message || "Failed to connect WhatsApp account");
    }
  }

  /**
   * Get connection status for organization
   * ✅ IMPORTANT: DISCONNECTED -> connected:false
   */
  static async getConnectionStatus(organizationId: string) {
    const connection = await prisma.metaConnection.findUnique({
      where: { organizationId },
      include: {
        phoneNumbers: { where: { isActive: true } },
      },
    });

    if (!connection) {
      return { connected: false, status: "NOT_CONNECTED" };
    }

    const isExpired =
      connection.accessTokenExpiresAt && new Date() > connection.accessTokenExpiresAt;

    if (isExpired && connection.status === "CONNECTED") {
      await prisma.metaConnection.update({
        where: { id: connection.id },
        data: { status: "TOKEN_EXPIRED" },
      });
    }

    const effectiveStatus = isExpired ? "TOKEN_EXPIRED" : connection.status;

    // ✅ connected only if CONNECTED and not expired
    const connected = effectiveStatus === "CONNECTED";

    return {
      connected,
      status: effectiveStatus,
      waba: { id: connection.wabaId, name: connection.wabaName },
      phoneNumbers: connection.phoneNumbers.map((p: any) => ({
        id: p.phoneNumberId,
        number: p.phoneNumber,
        verifiedName: p.verifiedName,
        quality: p.qualityRating,
        isPrimary: p.isPrimary,
      })),
      messagingLimit: connection.messagingLimit,
      qualityRating: connection.qualityRating,
      lastSynced: connection.lastSyncedAt,
    };
  }

  /**
   * Disconnect WhatsApp account
   * ✅ Clear token + deactivate numbers + set status DISCONNECTED
   */
  static async disconnect(organizationId: string) {
    const connection = await prisma.metaConnection.findUnique({
      where: { organizationId },
    });

    if (!connection) {
      throw new Error("No connection found");
    }

    await prisma.phoneNumber.updateMany({
      where: { metaConnectionId: connection.id },
      data: { isActive: false, isPrimary: false },
    });

    // accessToken required in schema, so set empty string
    await prisma.metaConnection.update({
      where: { organizationId },
      data: {
        status: "DISCONNECTED",
        errorMessage: "Manually disconnected by user",
        accessToken: "",
        accessTokenExpiresAt: null,
        lastSyncedAt: null,
        webhookVerified: false,
      },
    });

    return { success: true };
  }

  /**
   * Get decrypted access token for API calls
   */
  static async getAccessToken(organizationId: string): Promise<string> {
    const connection = await prisma.metaConnection.findUnique({ where: { organizationId } });

    if (!connection) throw new Error("WhatsApp not connected");
    if (connection.status !== "CONNECTED") throw new Error(`Connection status: ${connection.status}`);
    if (!connection.accessToken) throw new Error("No access token stored. Please reconnect.");

    if (connection.accessTokenExpiresAt && new Date() > connection.accessTokenExpiresAt) {
      throw new Error("Access token expired. Please reconnect.");
    }

    return EncryptionUtil.decrypt(connection.accessToken);
  }

  /**
   * ✅ Settings page data (IDs + webhook config + masked token)
   */
  static async getSettings(organizationId: string, baseUrl: string) {
    const connection = await prisma.metaConnection.findUnique({
      where: { organizationId },
      include: { phoneNumbers: { where: { isActive: true } } },
    });

    const webhookCallbackUrl = `${baseUrl.replace(/\/+$/, "")}/webhooks/meta`;

    if (!connection) {
      return {
        connected: false,
        webhook: {
          callbackUrl: webhookCallbackUrl,
          verifyTokenMasked: MetaService.maskSecret(process.env.META_WEBHOOK_VERIFY_TOKEN || "", 6, 4),
        },
        graphApiVersion: process.env.META_GRAPH_API_VERSION || "v21.0",
      };
    }

    // PhoneNumberId Meta ka actual field phoneNumberId hai
    const phoneNumbers = connection.phoneNumbers.map((p) => ({
      id: p.id,
      phoneNumberId: p.phoneNumberId,
      number: p.phoneNumber,
      verifiedName: p.verifiedName,
      qualityRating: p.qualityRating,
      isPrimary: p.isPrimary,
    }));

    return {
      connected: connection.status === "CONNECTED",
      status: connection.status,
      waba: {
        id: connection.wabaId,
        name: connection.wabaName,
      },
      phoneNumbers,
      token: {
        // ✅ security (do not reveal full token)
        masked: MetaService.maskSecret(connection.accessToken, 10, 6),
        expiresAt: connection.accessTokenExpiresAt,
      },
      webhook: {
        callbackUrl: webhookCallbackUrl,
        verifyTokenMasked: MetaService.maskSecret(process.env.META_WEBHOOK_VERIFY_TOKEN || "", 6, 4),
      },
      graphApiVersion: process.env.META_GRAPH_API_VERSION || "v21.0",
    };
  }
}