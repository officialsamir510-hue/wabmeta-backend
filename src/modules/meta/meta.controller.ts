// src/modules/meta/meta.controller.ts

import { Request, Response } from "express";
import { MetaService } from "./meta.service";
import { sendSuccess, sendError } from "../../utils/response";

export class MetaController {
  /**
   * GET /api/v1/meta/auth/url
   */
  static async getAuthUrl(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user as { id: string; organizationId: string } | undefined;

      const organizationId = user?.organizationId;
      const userId = user?.id;

      if (!organizationId || !userId) {
        sendError(res, "Unauthorized: User not authenticated", 401);
        return;
      }

      const authUrl = MetaService.getAuthorizationUrl(organizationId, userId);
      sendSuccess(res, { authUrl }, "Authorization URL generated");
    } catch (error: any) {
      console.error("Get auth URL error:", error);
      sendError(res, error.message || "Failed to generate auth URL", 500);
    }
  }

  /**
   * POST /api/v1/meta/auth/callback
   */
  static async handleCallback(req: Request, res: Response): Promise<void> {
    try {
      const { code, state } = req.body;

      if (!code || !state) {
        sendError(res, "Missing code or state parameter", 400);
        return;
      }

      const result = await MetaService.handleOAuthCallback(code, state);
      sendSuccess(res, result, "WhatsApp Business Account connected successfully");
    } catch (error: any) {
      console.error("OAuth callback error:", error);
      sendError(res, error.message || "Failed to connect WhatsApp", 500);
    }
  }

  /**
   * GET /api/v1/meta/status
   */
  static async getConnectionStatus(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user as { organizationId: string } | undefined;
      const organizationId = user?.organizationId;

      if (!organizationId) {
        sendError(res, "Unauthorized: Organization not found", 401);
        return;
      }

      const status = await MetaService.getConnectionStatus(organizationId);
      sendSuccess(res, status, "Connection status retrieved");
    } catch (error: any) {
      console.error("Get status error:", error);
      sendError(res, error.message || "Failed to get status", 500);
    }
  }

  /**
   * POST /api/v1/meta/disconnect
   */
  static async disconnect(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user as { organizationId: string } | undefined;
      const organizationId = user?.organizationId;

      if (!organizationId) {
        sendError(res, "Unauthorized: Organization not found", 401);
        return;
      }

      await MetaService.disconnect(organizationId);
      sendSuccess(res, null, "WhatsApp disconnected successfully");
    } catch (error: any) {
      console.error("Disconnect error:", error);
      sendError(res, error.message || "Failed to disconnect", 500);
    }
  }

  /**
   * GET /api/v1/meta/settings
   * ✅ For Settings -> API & Webhook page
   */
  static async getSettings(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user as { organizationId: string } | undefined;
      const organizationId = user?.organizationId;

      if (!organizationId) {
        sendError(res, "Unauthorized: Organization not found", 401);
        return;
      }

      // Prefer BACKEND_URL to avoid proxy protocol issues
      const baseUrl =
        process.env.BACKEND_URL ||
        `${req.protocol}://${req.get("host")}`;

      const settings = await MetaService.getSettings(organizationId, baseUrl);
      sendSuccess(res, settings, "Meta settings retrieved");
    } catch (error: any) {
      console.error("Get settings error:", error);
      sendError(res, error.message || "Failed to get settings", 500);
    }
  }
}