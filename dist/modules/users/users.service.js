"use strict";
// src/modules/users/users.service.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersService = exports.UsersService = void 0;
const database_1 = __importDefault(require("../../config/database"));
const errorHandler_1 = require("../../middleware/errorHandler");
const password_1 = require("../../utils/password");
// ============================================
// HELPER FUNCTIONS
// ============================================
const formatUserProfile = (user) => ({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    avatar: user.avatar,
    status: user.status,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
});
// ============================================
// USERS SERVICE CLASS
// ============================================
class UsersService {
    // ==========================================
    // GET USER PROFILE
    // ==========================================
    async getProfile(userId) {
        const user = await database_1.default.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            throw new errorHandler_1.AppError('User not found', 404);
        }
        return formatUserProfile(user);
    }
    // ==========================================
    // GET USER WITH ORGANIZATIONS
    // ==========================================
    async getUserWithOrganizations(userId) {
        const user = await database_1.default.user.findUnique({
            where: { id: userId },
            include: {
                ownedOrganizations: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },
                memberships: {
                    include: {
                        organization: {
                            select: {
                                id: true,
                                name: true,
                                slug: true,
                            },
                        },
                    },
                },
            },
        });
        if (!user) {
            throw new errorHandler_1.AppError('User not found', 404);
        }
        // Combine owned and member organizations
        const organizations = [
            ...user.ownedOrganizations.map((org) => ({
                id: org.id,
                name: org.name,
                slug: org.slug,
                role: 'OWNER',
                isOwner: true,
            })),
            ...user.memberships
                .filter((m) => !user.ownedOrganizations.some((o) => o.id === m.organization.id))
                .map((m) => ({
                id: m.organization.id,
                name: m.organization.name,
                slug: m.organization.slug,
                role: m.role,
                isOwner: false,
            })),
        ];
        return {
            ...formatUserProfile(user),
            organizations,
        };
    }
    // ==========================================
    // UPDATE PROFILE
    // ==========================================
    async updateProfile(userId, input) {
        const user = await database_1.default.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            throw new errorHandler_1.AppError('User not found', 404);
        }
        const updatedUser = await database_1.default.user.update({
            where: { id: userId },
            data: {
                firstName: input.firstName ?? user.firstName,
                lastName: input.lastName !== undefined ? input.lastName : user.lastName,
                phone: input.phone !== undefined ? input.phone : user.phone,
                avatar: input.avatar !== undefined ? input.avatar : user.avatar,
            },
        });
        return formatUserProfile(updatedUser);
    }
    // ==========================================
    // UPDATE AVATAR
    // ==========================================
    async updateAvatar(userId, avatarUrl) {
        const updatedUser = await database_1.default.user.update({
            where: { id: userId },
            data: { avatar: avatarUrl },
        });
        return formatUserProfile(updatedUser);
    }
    // ==========================================
    // GET USER STATS
    // ==========================================
    async getUserStats(userId) {
        const user = await database_1.default.user.findUnique({
            where: { id: userId },
            include: {
                ownedOrganizations: {
                    select: { id: true },
                },
                memberships: {
                    select: {
                        organizationId: true,
                    },
                },
            },
        });
        if (!user) {
            throw new errorHandler_1.AppError('User not found', 404);
        }
        // Get all organization IDs user belongs to
        const orgIds = [
            ...user.ownedOrganizations.map((o) => o.id),
            ...user.memberships.map((m) => m.organizationId),
        ];
        // Get stats from all organizations
        const [totalContacts, totalMessages, totalCampaigns] = await Promise.all([
            database_1.default.contact.count({
                where: { organizationId: { in: orgIds } },
            }),
            database_1.default.message.count({
                where: {
                    conversation: {
                        organizationId: { in: orgIds },
                    },
                },
            }),
            database_1.default.campaign.count({
                where: { organizationId: { in: orgIds } },
            }),
        ]);
        return {
            totalContacts,
            totalMessages,
            totalCampaigns,
            memberSince: user.createdAt,
        };
    }
    // ==========================================
    // GET ACTIVE SESSIONS
    // ==========================================
    async getActiveSessions(userId, currentToken) {
        const sessions = await database_1.default.refreshToken.findMany({
            where: {
                userId,
                expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: 'desc' },
        });
        return sessions.map((session) => ({
            id: session.id,
            userAgent: session.userAgent,
            ipAddress: session.ipAddress,
            createdAt: session.createdAt,
            expiresAt: session.expiresAt,
            isCurrent: session.token === currentToken,
        }));
    }
    // ==========================================
    // REVOKE SESSION
    // ==========================================
    async revokeSession(userId, sessionId) {
        const session = await database_1.default.refreshToken.findFirst({
            where: {
                id: sessionId,
                userId,
            },
        });
        if (!session) {
            throw new errorHandler_1.AppError('Session not found', 404);
        }
        await database_1.default.refreshToken.delete({
            where: { id: sessionId },
        });
        return { message: 'Session revoked successfully' };
    }
    // ==========================================
    // REVOKE ALL SESSIONS
    // ==========================================
    async revokeAllSessions(userId, exceptCurrent) {
        await database_1.default.refreshToken.deleteMany({
            where: {
                userId,
                ...(exceptCurrent && { token: { not: exceptCurrent } }),
            },
        });
        return { message: 'All sessions revoked successfully' };
    }
    // ==========================================
    // DELETE ACCOUNT
    // ==========================================
    async deleteAccount(userId, password, reason) {
        const user = await database_1.default.user.findUnique({
            where: { id: userId },
            include: {
                ownedOrganizations: true,
            },
        });
        if (!user) {
            throw new errorHandler_1.AppError('User not found', 404);
        }
        // Verify password (skip for OAuth users)
        if (user.password) {
            const isValid = await (0, password_1.comparePassword)(password, user.password);
            if (!isValid) {
                throw new errorHandler_1.AppError('Invalid password', 400);
            }
        }
        // Check if user owns any organizations with other members
        for (const org of user.ownedOrganizations) {
            const memberCount = await database_1.default.organizationMember.count({
                where: { organizationId: org.id },
            });
            if (memberCount > 1) {
                throw new errorHandler_1.AppError(`Cannot delete account. Please transfer ownership of "${org.name}" first.`, 400);
            }
        }
        // Log deletion reason
        if (reason) {
            await database_1.default.activityLog.create({
                data: {
                    userId,
                    action: 'DELETE',
                    metadata: { reason },
                },
            });
        }
        // Delete user and all related data (cascades)
        await database_1.default.$transaction(async (tx) => {
            // Delete owned organizations (will cascade to members, contacts, etc.)
            await tx.organization.deleteMany({
                where: { ownerId: userId },
            });
            // Delete user
            await tx.user.delete({
                where: { id: userId },
            });
        });
        return { message: 'Account deleted successfully' };
    }
    // ==========================================
    // GET USER BY ID (Admin)
    // ==========================================
    async getUserById(userId) {
        const user = await database_1.default.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            throw new errorHandler_1.AppError('User not found', 404);
        }
        return formatUserProfile(user);
    }
}
exports.UsersService = UsersService;
// Export singleton instance
exports.usersService = new UsersService();
//# sourceMappingURL=users.service.js.map