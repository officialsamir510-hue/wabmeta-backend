// src/modules/campaigns/campaigns.controller.ts

import { Request, Response, NextFunction } from 'express';
import { campaignsService } from './campaigns.service';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../middleware/errorHandler';
import {
  CreateCampaignInput,
  UpdateCampaignInput,
  CampaignsQueryInput,
  CampaignContactsQueryInput,
} from './campaigns.types';

// Extended Request interface
interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    organizationId?: string;
  };
}

export class CampaignsController {
  // ==========================================
  // CREATE CAMPAIGN
  // ==========================================
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const input: CreateCampaignInput = req.body;
      const campaign = await campaignsService.create(organizationId, req.user!.id, input);
      return sendSuccess(res, campaign, 'Campaign created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET CAMPAIGNS LIST
  // ==========================================
  async getList(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const query: CampaignsQueryInput = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        search: req.query.search as string,
        status: req.query.status as any,
        sortBy: (req.query.sortBy as any) || 'createdAt',
        sortOrder: (req.query.sortOrder as any) || 'desc',
      };

      const result = await campaignsService.getList(organizationId, query);
      return res.json({
        success: true,
        message: 'Campaigns fetched successfully',
        data: result.campaigns,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET CAMPAIGN BY ID
  // ==========================================
  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = req.params.id as string; // ✅ Fixed
      const campaign = await campaignsService.getById(organizationId, id);
      return sendSuccess(res, campaign, 'Campaign fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // UPDATE CAMPAIGN
  // ==========================================
  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = req.params.id as string; // ✅ Fixed
      const input: UpdateCampaignInput = req.body;
      const campaign = await campaignsService.update(organizationId, id, input);
      return sendSuccess(res, campaign, 'Campaign updated successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // DELETE CAMPAIGN
  // ==========================================
  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = req.params.id as string; // ✅ Fixed
      const result = await campaignsService.delete(organizationId, id);
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // START CAMPAIGN
  // ==========================================
  async start(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = req.params.id as string; // ✅ Fixed
      const campaign = await campaignsService.start(organizationId, id);
      return sendSuccess(res, campaign, 'Campaign started successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // PAUSE CAMPAIGN
  // ==========================================
  async pause(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = req.params.id as string; // ✅ Fixed
      const campaign = await campaignsService.pause(organizationId, id);
      return sendSuccess(res, campaign, 'Campaign paused successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // RESUME CAMPAIGN
  // ==========================================
  async resume(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = req.params.id as string; // ✅ Fixed
      const campaign = await campaignsService.resume(organizationId, id);
      return sendSuccess(res, campaign, 'Campaign resumed successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // CANCEL CAMPAIGN
  // ==========================================
  async cancel(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = req.params.id as string; // ✅ Fixed
      const campaign = await campaignsService.cancel(organizationId, id);
      return sendSuccess(res, campaign, 'Campaign cancelled successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET CAMPAIGN CONTACTS
  // ==========================================
  async getContacts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = req.params.id as string; // ✅ Fixed
      const query: CampaignContactsQueryInput = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 50,
        status: req.query.status as any,
      };

      const result = await campaignsService.getContacts(organizationId, id, query);
      return res.json({
        success: true,
        message: 'Campaign contacts fetched successfully',
        data: result.contacts,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // RETRY FAILED MESSAGES
  // ==========================================
  async retry(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = req.params.id as string; // ✅ Fixed
      const { retryFailed, retryPending } = req.body;
      const result = await campaignsService.retry(organizationId, id, retryFailed, retryPending);
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // DUPLICATE CAMPAIGN
  // ==========================================
  async duplicate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = req.params.id as string; // ✅ Fixed
      const { name } = req.body;
      const campaign = await campaignsService.duplicate(organizationId, id, name);
      return sendSuccess(res, campaign, 'Campaign duplicated successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET CAMPAIGN STATS
  // ==========================================
  async getStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const stats = await campaignsService.getStats(organizationId);
      return sendSuccess(res, stats, 'Stats fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET CAMPAIGN ANALYTICS
  // ==========================================
  async getAnalytics(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = req.params.id as string; // ✅ Fixed
      const analytics = await campaignsService.getAnalytics(organizationId, id);
      return sendSuccess(res, analytics, 'Analytics fetched successfully');
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const campaignsController = new CampaignsController();