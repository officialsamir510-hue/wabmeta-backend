import { Request, Response, NextFunction } from "express";
import { sendSuccess } from "../../utils/response";
import { AppError } from "../../middleware/errorHandler";
import { AuthRequest } from "../../types/express";
import { whatsappService } from "./whatsapp.service";

export class WhatsAppController {
  // GET /api/v1/whatsapp/webhook (Meta verify)
  async verifyWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const mode = req.query["hub.mode"] as string | undefined;
      const token = req.query["hub.verify_token"] as string | undefined;
      const challenge = req.query["hub.challenge"] as string | undefined;

      const response = whatsappService.verifyWebhook(mode, token, challenge);
      return res.status(200).send(response);
    } catch (e) {
      next(e);
    }
  }

  // POST /api/v1/whatsapp/webhook (events)
  async handleWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      await whatsappService.handleWebhook(req.body);
      return res.sendStatus(200);
    } catch (e) {
      // Still return 200 to avoid endless retries, but log internally
      console.error("Webhook handler error:", e);
      return res.sendStatus(200);
    }
  }

  // POST /api/v1/whatsapp/connect (Auth required)
  async connectAccount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) throw new AppError("Organization context required", 400);

      const { code, redirectUri } = req.body as { code?: string; redirectUri?: string };
      if (!code || !redirectUri) throw new AppError("code and redirectUri are required", 400);

      const account = await whatsappService.connectAccount(organizationId, code, redirectUri);
      return sendSuccess(res, account, "WhatsApp account connected successfully", 201);
    } catch (e) {
      next(e);
    }
  }

  // Optional placeholders to match your routes (implement later)
  async getAccounts(req: AuthRequest, res: Response) {
    return sendSuccess(res, [], "Not implemented");
  }
  async getAccountById(req: AuthRequest, res: Response) {
    return sendSuccess(res, null, "Not implemented");
  }
  async disconnectAccount(req: AuthRequest, res: Response) {
    return sendSuccess(res, null, "Not implemented");
  }
  async setDefaultAccount(req: AuthRequest, res: Response) {
    return sendSuccess(res, null, "Not implemented");
  }
  async sendTextMessage(req: AuthRequest, res: Response) {
    return sendSuccess(res, null, "Not implemented");
  }
  async sendTemplateMessage(req: AuthRequest, res: Response) {
    return sendSuccess(res, null, "Not implemented");
  }
  async sendMediaMessage(req: AuthRequest, res: Response) {
    return sendSuccess(res, null, "Not implemented");
  }
  async sendInteractiveMessage(req: AuthRequest, res: Response) {
    return sendSuccess(res, null, "Not implemented");
  }
  async syncTemplates(req: AuthRequest, res: Response) {
    return sendSuccess(res, null, "Not implemented");
  }
  async getMediaUrl(req: AuthRequest, res: Response) {
    return sendSuccess(res, null, "Not implemented");
  }
}

export const whatsappController = new WhatsAppController();