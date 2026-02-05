// src/modules/organizations/organizations.routes.ts

import { Router } from 'express';
import { organizationsController } from './organizations.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
  transferOwnershipSchema,
} from './organizations.schema';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/v1/organizations
 * @desc    Create new organization
 * @access  Private
 */
router.post(
  '/',
  validate(createOrganizationSchema),
  organizationsController.create.bind(organizationsController)
);

/**
 * @route   GET /api/v1/organizations
 * @desc    Get user's organizations
 * @access  Private
 */
router.get(
  '/',
  organizationsController.getMyOrganizations.bind(organizationsController)
);

/**
 * @route   GET /api/v1/organizations/current
 * @desc    Get current active organization
 * @access  Private
 */
router.get(
  '/current',
  organizationsController.getCurrent.bind(organizationsController)
);

/**
 * @route   GET /api/v1/organizations/:id
 * @desc    Get organization by ID
 * @access  Private
 */
router.get(
  '/:id',
  organizationsController.getById.bind(organizationsController)
);

/**
 * @route   PUT /api/v1/organizations/:id
 * @desc    Update organization
 * @access  Private (Admin/Owner)
 */
router.put(
  '/:id',
  validate(updateOrganizationSchema),
  organizationsController.update.bind(organizationsController)
);

/**
 * @route   GET /api/v1/organizations/:id/stats
 * @desc    Get organization stats
 * @access  Private
 */
router.get(
  '/:id/stats',
  organizationsController.getStats.bind(organizationsController)
);

/**
 * @route   POST /api/v1/organizations/:id/members
 * @desc    Invite member to organization
 * @access  Private (Admin/Owner)
 */
router.post(
  '/:id/members',
  validate(inviteMemberSchema),
  organizationsController.inviteMember.bind(organizationsController)
);

/**
 * @route   PUT /api/v1/organizations/:id/members/:memberId
 * @desc    Update member role
 * @access  Private (Owner)
 */
router.put(
  '/:id/members/:memberId',
  validate(updateMemberRoleSchema),
  organizationsController.updateMemberRole.bind(organizationsController)
);

/**
 * @route   DELETE /api/v1/organizations/:id/members/:memberId
 * @desc    Remove member from organization
 * @access  Private (Admin/Owner)
 */
router.delete(
  '/:id/members/:memberId',
  organizationsController.removeMember.bind(organizationsController)
);

/**
 * @route   POST /api/v1/organizations/:id/leave
 * @desc    Leave organization
 * @access  Private
 */
router.post(
  '/:id/leave',
  organizationsController.leave.bind(organizationsController)
);

/**
 * @route   POST /api/v1/organizations/:id/transfer
 * @desc    Transfer ownership
 * @access  Private (Owner)
 */
router.post(
  '/:id/transfer',
  validate(transferOwnershipSchema),
  organizationsController.transferOwnership.bind(organizationsController)
);

/**
 * @route   DELETE /api/v1/organizations/:id
 * @desc    Delete organization
 * @access  Private (Owner)
 */
router.delete(
  '/:id',
  organizationsController.delete.bind(organizationsController)
);

export default router;