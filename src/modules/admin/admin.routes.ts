// src/modules/admin/admin.routes.ts

import { Router } from 'express';
import { adminController } from './admin.controller';
import { validate } from '../../middleware/validate';
import { authenticateAdmin, requireSuperAdmin } from './admin.middleware';
import {
  adminLoginSchema,
  createAdminSchema,
  updateAdminSchema,
  getUsersSchema,
  getUserByIdSchema,
  updateUserSchema,
  deleteUserSchema,
  getOrganizationsSchema,
  getOrganizationByIdSchema,
  updateOrganizationSchema,
  deleteOrganizationSchema,
  updateSubscriptionSchema,
  createPlanSchema,
  updatePlanSchema,
  updateSystemSettingsSchema,
  getActivityLogsSchema,
} from './admin.schema';

const router = Router();

// ============================================
// PUBLIC ROUTES (No Admin Auth)
// ============================================

/**
 * @route   POST /api/v1/admin/login
 * @desc    Admin login
 * @access  Public
 */
router.post(
  '/login',
  validate(adminLoginSchema),
  adminController.login.bind(adminController)
);

// ============================================
// PROTECTED ROUTES (Admin Auth Required)
// ============================================

router.use(authenticateAdmin);

/**
 * @route   GET /api/v1/admin/profile
 * @desc    Get admin profile
 * @access  Admin
 */
router.get('/profile', adminController.getProfile.bind(adminController));

/**
 * @route   GET /api/v1/admin/dashboard
 * @desc    Get dashboard statistics
 * @access  Admin
 */
router.get('/dashboard', adminController.getDashboardStats.bind(adminController));

// ============================================
// USER MANAGEMENT
// ============================================

/**
 * @route   GET /api/v1/admin/users
 * @desc    Get all users
 * @access  Admin
 */
router.get(
  '/users',
  validate(getUsersSchema),
  adminController.getUsers.bind(adminController)
);

/**
 * @route   GET /api/v1/admin/users/:id
 * @desc    Get user by ID
 * @access  Admin
 */
router.get(
  '/users/:id',
  validate(getUserByIdSchema),
  adminController.getUserById.bind(adminController)
);

/**
 * @route   PUT /api/v1/admin/users/:id
 * @desc    Update user
 * @access  Admin
 */
router.put(
  '/users/:id',
  validate(updateUserSchema),
  adminController.updateUser.bind(adminController)
);

/**
 * @route   DELETE /api/v1/admin/users/:id
 * @desc    Delete user
 * @access  Super Admin
 */
router.delete(
  '/users/:id',
  requireSuperAdmin,
  validate(deleteUserSchema),
  adminController.deleteUser.bind(adminController)
);

/**
 * @route   POST /api/v1/admin/users/:id/suspend
 * @desc    Suspend user
 * @access  Admin
 */
router.post(
  '/users/:id/suspend',
  validate(getUserByIdSchema),
  adminController.suspendUser.bind(adminController)
);

/**
 * @route   POST /api/v1/admin/users/:id/activate
 * @desc    Activate user
 * @access  Admin
 */
router.post(
  '/users/:id/activate',
  validate(getUserByIdSchema),
  adminController.activateUser.bind(adminController)
);

// ============================================
// ORGANIZATION MANAGEMENT
// ============================================

/**
 * @route   GET /api/v1/admin/organizations
 * @desc    Get all organizations
 * @access  Admin
 */
router.get(
  '/organizations',
  validate(getOrganizationsSchema),
  adminController.getOrganizations.bind(adminController)
);

/**
 * @route   GET /api/v1/admin/organizations/:id
 * @desc    Get organization by ID
 * @access  Admin
 */
router.get(
  '/organizations/:id',
  validate(getOrganizationByIdSchema),
  adminController.getOrganizationById.bind(adminController)
);

/**
 * @route   PUT /api/v1/admin/organizations/:id
 * @desc    Update organization
 * @access  Admin
 */
router.put(
  '/organizations/:id',
  validate(updateOrganizationSchema),
  adminController.updateOrganization.bind(adminController)
);

/**
 * @route   DELETE /api/v1/admin/organizations/:id
 * @desc    Delete organization
 * @access  Super Admin
 */
router.delete(
  '/organizations/:id',
  requireSuperAdmin,
  validate(deleteOrganizationSchema),
  adminController.deleteOrganization.bind(adminController)
);

/**
 * @route   PUT /api/v1/admin/organizations/:id/subscription
 * @desc    Update organization subscription
 * @access  Admin
 */
router.put(
  '/organizations/:id/subscription',
  validate(updateSubscriptionSchema),
  adminController.updateSubscription.bind(adminController)
);

// ============================================
// PLAN MANAGEMENT
// ============================================

/**
 * @route   GET /api/v1/admin/plans
 * @desc    Get all plans
 * @access  Admin
 */
router.get('/plans', adminController.getPlans.bind(adminController));

/**
 * @route   POST /api/v1/admin/plans
 * @desc    Create plan
 * @access  Super Admin
 */
router.post(
  '/plans',
  requireSuperAdmin,
  validate(createPlanSchema),
  adminController.createPlan.bind(adminController)
);

/**
 * @route   PUT /api/v1/admin/plans/:id
 * @desc    Update plan
 * @access  Super Admin
 */
router.put(
  '/plans/:id',
  requireSuperAdmin,
  validate(updatePlanSchema),
  adminController.updatePlan.bind(adminController)
);

// ============================================
// ADMIN MANAGEMENT (Super Admin Only)
// ============================================

/**
 * @route   GET /api/v1/admin/admins
 * @desc    Get all admins
 * @access  Super Admin
 */
router.get(
  '/admins',
  requireSuperAdmin,
  adminController.getAdmins.bind(adminController)
);

/**
 * @route   POST /api/v1/admin/admins
 * @desc    Create new admin
 * @access  Super Admin
 */
router.post(
  '/admins',
  requireSuperAdmin,
  validate(createAdminSchema),
  adminController.createAdmin.bind(adminController)
);

/**
 * @route   PUT /api/v1/admin/admins/:id
 * @desc    Update admin
 * @access  Super Admin
 */
router.put(
  '/admins/:id',
  requireSuperAdmin,
  validate(updateAdminSchema),
  adminController.updateAdmin.bind(adminController)
);

/**
 * @route   DELETE /api/v1/admin/admins/:id
 * @desc    Delete admin
 * @access  Super Admin
 */
router.delete(
  '/admins/:id',
  requireSuperAdmin,
  adminController.deleteAdmin.bind(adminController)
);

// ============================================
// ACTIVITY LOGS
// ============================================

/**
 * @route   GET /api/v1/admin/activity-logs
 * @desc    Get activity logs
 * @access  Admin
 */
router.get(
  '/activity-logs',
  validate(getActivityLogsSchema),
  adminController.getActivityLogs.bind(adminController)
);

// ============================================
// SYSTEM SETTINGS
// ============================================

/**
 * @route   GET /api/v1/admin/settings
 * @desc    Get system settings
 * @access  Admin
 */
router.get('/settings', adminController.getSystemSettings.bind(adminController));

/**
 * @route   PUT /api/v1/admin/settings
 * @desc    Update system settings
 * @access  Super Admin
 */
router.put(
  '/settings',
  requireSuperAdmin,
  validate(updateSystemSettingsSchema),
  adminController.updateSystemSettings.bind(adminController)
);

export default router;