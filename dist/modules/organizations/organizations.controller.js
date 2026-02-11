"use strict";
// src/modules/organizations/organizations.controller.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.organizationsController = exports.OrganizationsController = void 0;
const organizations_service_1 = require("./organizations.service");
const response_1 = require("../../utils/response");
class OrganizationsController {
    // ==========================================
    // CREATE ORGANIZATION
    // ==========================================
    async create(req, res, next) {
        try {
            const userId = req.user.id;
            const input = req.body;
            const organization = await organizations_service_1.organizationsService.create(userId, input);
            return (0, response_1.sendSuccess)(res, organization, 'Organization created successfully', 201);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // GET MY ORGANIZATIONS
    // ==========================================
    async getMyOrganizations(req, res, next) {
        try {
            const userId = req.user.id;
            const organizations = await organizations_service_1.organizationsService.getUserOrganizations(userId);
            return (0, response_1.sendSuccess)(res, organizations, 'Organizations fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // GET ORGANIZATION BY ID
    // ==========================================
    async getById(req, res, next) {
        try {
            const userId = req.user.id;
            const id = req.params.id;
            const organization = await organizations_service_1.organizationsService.getById(id, userId);
            return (0, response_1.sendSuccess)(res, organization, 'Organization fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // GET CURRENT ORGANIZATION
    // ==========================================
    async getCurrent(req, res, next) {
        try {
            const userId = req.user.id;
            const organizationId = req.user.organizationId;
            if (!organizationId) {
                return (0, response_1.sendSuccess)(res, null, 'No organization selected');
            }
            const organization = await organizations_service_1.organizationsService.getById(organizationId, userId);
            return (0, response_1.sendSuccess)(res, organization, 'Organization fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // UPDATE ORGANIZATION
    // ==========================================
    async update(req, res, next) {
        try {
            const userId = req.user.id;
            const id = req.params.id;
            const input = req.body;
            const organization = await organizations_service_1.organizationsService.update(id, userId, input);
            return (0, response_1.sendSuccess)(res, organization, 'Organization updated successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // INVITE MEMBER
    // ==========================================
    async inviteMember(req, res, next) {
        try {
            const userId = req.user.id;
            const id = req.params.id;
            const { email, role } = req.body;
            const result = await organizations_service_1.organizationsService.inviteMember(id, userId, email, role);
            return (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // UPDATE MEMBER ROLE
    // ==========================================
    async updateMemberRole(req, res, next) {
        try {
            const userId = req.user.id;
            const id = req.params.id;
            const memberId = req.params.memberId;
            const { role } = req.body;
            const result = await organizations_service_1.organizationsService.updateMemberRole(id, userId, memberId, role);
            return (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // REMOVE MEMBER
    // ==========================================
    async removeMember(req, res, next) {
        try {
            const userId = req.user.id;
            const id = req.params.id;
            const memberId = req.params.memberId;
            const result = await organizations_service_1.organizationsService.removeMember(id, userId, memberId);
            return (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // LEAVE ORGANIZATION
    // ==========================================
    async leave(req, res, next) {
        try {
            const userId = req.user.id;
            const id = req.params.id;
            const result = await organizations_service_1.organizationsService.leaveOrganization(id, userId);
            return (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // TRANSFER OWNERSHIP
    // ==========================================
    async transferOwnership(req, res, next) {
        try {
            const userId = req.user.id;
            const id = req.params.id;
            const { newOwnerId, password } = req.body;
            const result = await organizations_service_1.organizationsService.transferOwnership(id, userId, newOwnerId, password);
            return (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // GET STATS
    // ==========================================
    async getStats(req, res, next) {
        try {
            const userId = req.user.id;
            const id = req.params.id;
            const stats = await organizations_service_1.organizationsService.getStats(id, userId);
            return (0, response_1.sendSuccess)(res, stats, 'Stats fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    // ==========================================
    // DELETE ORGANIZATION
    // ==========================================
    async delete(req, res, next) {
        try {
            const userId = req.user.id;
            const id = req.params.id;
            const { password } = req.body;
            const result = await organizations_service_1.organizationsService.delete(id, userId, password);
            return (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
}
exports.OrganizationsController = OrganizationsController;
// Export singleton instance
exports.organizationsController = new OrganizationsController();
//# sourceMappingURL=organizations.controller.js.map