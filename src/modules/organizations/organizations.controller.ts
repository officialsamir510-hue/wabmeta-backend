// src/modules/organizations/organizations.controller.ts

import { Request, Response, NextFunction } from 'express';
import { organizationsService } from './organizations.service';
import { sendSuccess } from '../../utils/response';
import {
  CreateOrganizationInput,
  UpdateOrganizationInput,
  InviteMemberInput,
  UpdateMemberRoleInput,
  TransferOwnershipInput,
} from './organizations.types';

// Extended Request interface
interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    organizationId?: string;
  };
}

export class OrganizationsController {
  // ==========================================
  // CREATE ORGANIZATION
  // ==========================================
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const input: CreateOrganizationInput = req.body;
      const organization = await organizationsService.create(userId, input);
      return sendSuccess(res, organization, 'Organization created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET MY ORGANIZATIONS
  // ==========================================
  async getMyOrganizations(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const organizations = await organizationsService.getUserOrganizations(userId);
      return sendSuccess(res, organizations, 'Organizations fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET ORGANIZATION BY ID
  // ==========================================
  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const organization = await organizationsService.getById(id, userId);
      return sendSuccess(res, organization, 'Organization fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET CURRENT ORGANIZATION
  // ==========================================
  async getCurrent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const organizationId = req.user!.organizationId;

      if (!organizationId) {
        return sendSuccess(res, null, 'No organization selected');
      }

      const organization = await organizationsService.getById(organizationId, userId);
      return sendSuccess(res, organization, 'Organization fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // UPDATE ORGANIZATION
  // ==========================================
  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const input: UpdateOrganizationInput = req.body;
      const organization = await organizationsService.update(id, userId, input);
      return sendSuccess(res, organization, 'Organization updated successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // INVITE MEMBER
  // ==========================================
  async inviteMember(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { email, role }: InviteMemberInput = req.body;
      const result = await organizationsService.inviteMember(id, userId, email, role);
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // UPDATE MEMBER ROLE
  // ==========================================
  async updateMemberRole(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { id, memberId } = req.params;
      const { role }: UpdateMemberRoleInput = req.body;
      const result = await organizationsService.updateMemberRole(id, userId, memberId, role);
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // REMOVE MEMBER
  // ==========================================
  async removeMember(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { id, memberId } = req.params;
      const result = await organizationsService.removeMember(id, userId, memberId);
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // LEAVE ORGANIZATION
  // ==========================================
  async leave(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const result = await organizationsService.leaveOrganization(id, userId);
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // TRANSFER OWNERSHIP
  // ==========================================
  async transferOwnership(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { newOwnerId, password }: TransferOwnershipInput = req.body;
      const result = await organizationsService.transferOwnership(id, userId, newOwnerId, password);
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET STATS
  // ==========================================
  async getStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const stats = await organizationsService.getStats(id, userId);
      return sendSuccess(res, stats, 'Stats fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // DELETE ORGANIZATION
  // ==========================================
  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { password } = req.body;
      const result = await organizationsService.delete(id, userId, password);
      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const organizationsController = new OrganizationsController();