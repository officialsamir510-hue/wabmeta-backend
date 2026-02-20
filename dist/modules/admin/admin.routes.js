"use strict";
// src/modules/admin/admin.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const admin_controller_1 = require("./admin.controller");
const validate_1 = require("../../middleware/validate");
const admin_middleware_1 = require("./admin.middleware");
const admin_schema_1 = require("./admin.schema");
const router = (0, express_1.Router)();
// ============================================
// PUBLIC ROUTES (No Admin Auth)
// ============================================
/**
 * @route   POST /api/v1/admin/login
 * @desc    Admin login
 * @access  Public
 */
router.post('/login', (0, validate_1.validate)(admin_schema_1.adminLoginSchema), admin_controller_1.adminController.login.bind(admin_controller_1.adminController));
// ============================================
// PROTECTED ROUTES (Admin Auth Required)
// ============================================
router.use(admin_middleware_1.authenticateAdmin);
/**
 * @route   GET /api/v1/admin/profile
 * @desc    Get admin profile
 * @access  Admin
 */
router.get('/profile', admin_controller_1.adminController.getProfile.bind(admin_controller_1.adminController));
/**
 * @route   GET /api/v1/admin/dashboard
 * @desc    Get dashboard statistics
 * @access  Admin
 */
router.get('/dashboard', admin_controller_1.adminController.getDashboardStats.bind(admin_controller_1.adminController));
// ============================================
// USER MANAGEMENT
// ============================================
/**
 * @route   GET /api/v1/admin/users
 * @desc    Get all users with pagination
 * @access  Admin
 */
router.get('/users', (0, validate_1.validate)(admin_schema_1.getUsersSchema), admin_controller_1.adminController.getUsers.bind(admin_controller_1.adminController));
/**
 * @route   GET /api/v1/admin/users/:id
 * @desc    Get user by ID
 * @access  Admin
 */
router.get('/users/:id', (0, validate_1.validate)(admin_schema_1.getUserByIdSchema), admin_controller_1.adminController.getUserById.bind(admin_controller_1.adminController));
/**
 * @route   PUT /api/v1/admin/users/:id
 * @desc    Update user
 * @access  Admin
 */
router.put('/users/:id', (0, validate_1.validate)(admin_schema_1.updateUserSchema), admin_controller_1.adminController.updateUser.bind(admin_controller_1.adminController));
/**
 * @route   PATCH /api/v1/admin/users/:id/status
 * @desc    Update user status (ACTIVE, SUSPENDED, etc.)
 * @access  Admin
 */
router.patch('/users/:id/status', (0, validate_1.validate)(admin_schema_1.updateUserStatusSchema), admin_controller_1.adminController.updateUserStatus.bind(admin_controller_1.adminController));
/**
 * @route   POST /api/v1/admin/users/:id/suspend
 * @desc    Suspend user
 * @access  Admin
 */
router.post('/users/:id/suspend', (0, validate_1.validate)(admin_schema_1.getUserByIdSchema), admin_controller_1.adminController.suspendUser.bind(admin_controller_1.adminController));
/**
 * @route   POST /api/v1/admin/users/:id/activate
 * @desc    Activate user
 * @access  Admin
 */
router.post('/users/:id/activate', (0, validate_1.validate)(admin_schema_1.getUserByIdSchema), admin_controller_1.adminController.activateUser.bind(admin_controller_1.adminController));
/**
 * @route   DELETE /api/v1/admin/users/:id
 * @desc    Delete user
 * @access  Super Admin
 */
router.delete('/users/:id', admin_middleware_1.requireSuperAdmin, (0, validate_1.validate)(admin_schema_1.deleteUserSchema), admin_controller_1.adminController.deleteUser.bind(admin_controller_1.adminController));
// ============================================
// ORGANIZATION MANAGEMENT
// ============================================
/**
 * @route   GET /api/v1/admin/organizations
 * @desc    Get all organizations
 * @access  Admin
 */
router.get('/organizations', (0, validate_1.validate)(admin_schema_1.getOrganizationsSchema), admin_controller_1.adminController.getOrganizations.bind(admin_controller_1.adminController));
/**
 * @route   GET /api/v1/admin/organizations/:id
 * @desc    Get organization by ID
 * @access  Admin
 */
router.get('/organizations/:id', (0, validate_1.validate)(admin_schema_1.getOrganizationByIdSchema), admin_controller_1.adminController.getOrganizationById.bind(admin_controller_1.adminController));
/**
 * @route   PUT /api/v1/admin/organizations/:id
 * @desc    Update organization
 * @access  Admin
 */
router.put('/organizations/:id', (0, validate_1.validate)(admin_schema_1.updateOrganizationSchema), admin_controller_1.adminController.updateOrganization.bind(admin_controller_1.adminController));
/**
 * @route   DELETE /api/v1/admin/organizations/:id
 * @desc    Delete organization
 * @access  Super Admin
 */
router.delete('/organizations/:id', admin_middleware_1.requireSuperAdmin, (0, validate_1.validate)(admin_schema_1.deleteOrganizationSchema), admin_controller_1.adminController.deleteOrganization.bind(admin_controller_1.adminController));
/**
 * @route   PUT /api/v1/admin/organizations/:id/subscription
 * @desc    Update organization subscription
 * @access  Admin
 */
router.put('/organizations/:id/subscription', (0, validate_1.validate)(admin_schema_1.updateSubscriptionSchema), admin_controller_1.adminController.updateSubscription.bind(admin_controller_1.adminController));
// ============================================
// PLAN MANAGEMENT
// ============================================
/**
 * @route   GET /api/v1/admin/plans
 * @desc    Get all plans
 * @access  Admin
 */
router.get('/plans', admin_controller_1.adminController.getPlans.bind(admin_controller_1.adminController));
/**
 * @route   POST /api/v1/admin/plans
 * @desc    Create plan
 * @access  Super Admin
 */
router.post('/plans', admin_middleware_1.requireSuperAdmin, (0, validate_1.validate)(admin_schema_1.createPlanSchema), admin_controller_1.adminController.createPlan.bind(admin_controller_1.adminController));
/**
 * @route   PUT /api/v1/admin/plans/:id
 * @desc    Update plan
 * @access  Super Admin
 */
router.put('/plans/:id', admin_middleware_1.requireSuperAdmin, (0, validate_1.validate)(admin_schema_1.updatePlanSchema), admin_controller_1.adminController.updatePlan.bind(admin_controller_1.adminController));
/**
 * @route   DELETE /api/v1/admin/plans/:id
 * @desc    Delete plan
 * @access  Super Admin
 */
router.delete('/plans/:id', admin_middleware_1.requireSuperAdmin, admin_controller_1.adminController.deletePlan.bind(admin_controller_1.adminController));
// ============================================
// ADMIN MANAGEMENT (Super Admin Only)
// ============================================
/**
 * @route   GET /api/v1/admin/admins
 * @desc    Get all admins
 * @access  Super Admin
 */
router.get('/admins', admin_middleware_1.requireSuperAdmin, admin_controller_1.adminController.getAdmins.bind(admin_controller_1.adminController));
/**
 * @route   POST /api/v1/admin/admins
 * @desc    Create new admin
 * @access  Super Admin
 */
router.post('/admins', admin_middleware_1.requireSuperAdmin, (0, validate_1.validate)(admin_schema_1.createAdminSchema), admin_controller_1.adminController.createAdmin.bind(admin_controller_1.adminController));
/**
 * @route   PUT /api/v1/admin/admins/:id
 * @desc    Update admin
 * @access  Super Admin
 */
router.put('/admins/:id', admin_middleware_1.requireSuperAdmin, (0, validate_1.validate)(admin_schema_1.updateAdminSchema), admin_controller_1.adminController.updateAdmin.bind(admin_controller_1.adminController));
/**
 * @route   DELETE /api/v1/admin/admins/:id
 * @desc    Delete admin
 * @access  Super Admin
 */
router.delete('/admins/:id', admin_middleware_1.requireSuperAdmin, admin_controller_1.adminController.deleteAdmin.bind(admin_controller_1.adminController));
// ============================================
// ACTIVITY LOGS
// ============================================
/**
 * @route   GET /api/v1/admin/activity-logs
 * @desc    Get activity logs
 * @access  Admin
 */
router.get('/activity-logs', (0, validate_1.validate)(admin_schema_1.getActivityLogsSchema), admin_controller_1.adminController.getActivityLogs.bind(admin_controller_1.adminController));
// ============================================
// SYSTEM SETTINGS
// ============================================
/**
 * @route   GET /api/v1/admin/settings
 * @desc    Get system settings
 * @access  Admin
 */
router.get('/settings', admin_controller_1.adminController.getSystemSettings.bind(admin_controller_1.adminController));
/**
 * @route   PUT /api/v1/admin/settings
 * @desc    Update system settings
 * @access  Super Admin
 */
router.put('/settings', admin_middleware_1.requireSuperAdmin, (0, validate_1.validate)(admin_schema_1.updateSystemSettingsSchema), admin_controller_1.adminController.updateSystemSettings.bind(admin_controller_1.adminController));
exports.default = router;
//# sourceMappingURL=admin.routes.js.map