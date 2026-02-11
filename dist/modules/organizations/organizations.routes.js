"use strict";
// src/modules/organizations/organizations.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const organizations_controller_1 = require("./organizations.controller");
const validate_1 = require("../../middleware/validate");
const auth_1 = require("../../middleware/auth");
const organizations_schema_1 = require("./organizations.schema");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authenticate);
/**
 * @route   POST /api/v1/organizations
 * @desc    Create new organization
 * @access  Private
 */
router.post('/', (0, validate_1.validate)(organizations_schema_1.createOrganizationSchema), organizations_controller_1.organizationsController.create.bind(organizations_controller_1.organizationsController));
/**
 * @route   GET /api/v1/organizations
 * @desc    Get user's organizations
 * @access  Private
 */
router.get('/', organizations_controller_1.organizationsController.getMyOrganizations.bind(organizations_controller_1.organizationsController));
/**
 * @route   GET /api/v1/organizations/current
 * @desc    Get current active organization
 * @access  Private
 */
router.get('/current', organizations_controller_1.organizationsController.getCurrent.bind(organizations_controller_1.organizationsController));
/**
 * @route   GET /api/v1/organizations/:id
 * @desc    Get organization by ID
 * @access  Private
 */
router.get('/:id', organizations_controller_1.organizationsController.getById.bind(organizations_controller_1.organizationsController));
/**
 * @route   PUT /api/v1/organizations/:id
 * @desc    Update organization
 * @access  Private (Admin/Owner)
 */
router.put('/:id', (0, validate_1.validate)(organizations_schema_1.updateOrganizationSchema), organizations_controller_1.organizationsController.update.bind(organizations_controller_1.organizationsController));
/**
 * @route   GET /api/v1/organizations/:id/stats
 * @desc    Get organization stats
 * @access  Private
 */
router.get('/:id/stats', organizations_controller_1.organizationsController.getStats.bind(organizations_controller_1.organizationsController));
/**
 * @route   POST /api/v1/organizations/:id/members
 * @desc    Invite member to organization
 * @access  Private (Admin/Owner)
 */
router.post('/:id/members', (0, validate_1.validate)(organizations_schema_1.inviteMemberSchema), organizations_controller_1.organizationsController.inviteMember.bind(organizations_controller_1.organizationsController));
/**
 * @route   PUT /api/v1/organizations/:id/members/:memberId
 * @desc    Update member role
 * @access  Private (Owner)
 */
router.put('/:id/members/:memberId', (0, validate_1.validate)(organizations_schema_1.updateMemberRoleSchema), organizations_controller_1.organizationsController.updateMemberRole.bind(organizations_controller_1.organizationsController));
/**
 * @route   DELETE /api/v1/organizations/:id/members/:memberId
 * @desc    Remove member from organization
 * @access  Private (Admin/Owner)
 */
router.delete('/:id/members/:memberId', organizations_controller_1.organizationsController.removeMember.bind(organizations_controller_1.organizationsController));
/**
 * @route   POST /api/v1/organizations/:id/leave
 * @desc    Leave organization
 * @access  Private
 */
router.post('/:id/leave', organizations_controller_1.organizationsController.leave.bind(organizations_controller_1.organizationsController));
/**
 * @route   POST /api/v1/organizations/:id/transfer
 * @desc    Transfer ownership
 * @access  Private (Owner)
 */
router.post('/:id/transfer', (0, validate_1.validate)(organizations_schema_1.transferOwnershipSchema), organizations_controller_1.organizationsController.transferOwnership.bind(organizations_controller_1.organizationsController));
/**
 * @route   DELETE /api/v1/organizations/:id
 * @desc    Delete organization
 * @access  Private (Owner)
 */
router.delete('/:id', organizations_controller_1.organizationsController.delete.bind(organizations_controller_1.organizationsController));
exports.default = router;
//# sourceMappingURL=organizations.routes.js.map