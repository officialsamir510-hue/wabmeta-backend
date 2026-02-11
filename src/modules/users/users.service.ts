// src/modules/users/users.service.ts

import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { comparePassword } from '../../utils/password';
import {
  UpdateProfileInput,
  UserProfile,
  UserWithOrganizations,
  UserStats,
  SessionInfo,
} from './users.types';

// ============================================
// HELPER FUNCTIONS
// ============================================

const formatUserProfile = (user: any): UserProfile => ({
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

export class UsersService {
  // ==========================================
  // GET USER PROFILE
  // ==========================================
  async getProfile(userId: string): Promise<UserProfile> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return formatUserProfile(user);
  }

  // ==========================================
  // GET USER WITH ORGANIZATIONS
  // ==========================================
  async getUserWithOrganizations(userId: string): Promise<UserWithOrganizations> {
    const user = await prisma.user.findUnique({
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
      throw new AppError('User not found', 404);
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
  async updateProfile(userId: string, input: UpdateProfileInput): Promise<UserProfile> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const updatedUser = await prisma.user.update({
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
  async updateAvatar(userId: string, avatarUrl: string): Promise<UserProfile> {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { avatar: avatarUrl },
    });

    return formatUserProfile(updatedUser);
  }

  // ==========================================
  // GET USER STATS
  // ==========================================
  async getUserStats(userId: string): Promise<UserStats> {
    const user = await prisma.user.findUnique({
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
      throw new AppError('User not found', 404);
    }

    // Get all organization IDs user belongs to
    const orgIds = [
      ...user.ownedOrganizations.map((o) => o.id),
      ...user.memberships.map((m) => m.organizationId),
    ];

    // Get stats from all organizations
    const [totalContacts, totalMessages, totalCampaigns] = await Promise.all([
      prisma.contact.count({
        where: { organizationId: { in: orgIds } },
      }),
      prisma.message.count({
        where: {
          conversation: {
            organizationId: { in: orgIds },
          },
        },
      }),
      prisma.campaign.count({
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
  async getActiveSessions(userId: string, currentToken?: string): Promise<SessionInfo[]> {
    const sessions = await prisma.refreshToken.findMany({
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
  async revokeSession(userId: string, sessionId: string): Promise<{ message: string }> {
    const session = await prisma.refreshToken.findFirst({
      where: {
        id: sessionId,
        userId,
      },
    });

    if (!session) {
      throw new AppError('Session not found', 404);
    }

    await prisma.refreshToken.delete({
      where: { id: sessionId },
    });

    return { message: 'Session revoked successfully' };
  }

  // ==========================================
  // REVOKE ALL SESSIONS
  // ==========================================
  async revokeAllSessions(userId: string, exceptCurrent?: string): Promise<{ message: string }> {
    await prisma.refreshToken.deleteMany({
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
  async deleteAccount(
    userId: string,
    password: string,
    reason?: string
  ): Promise<{ message: string }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        ownedOrganizations: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Verify password (skip for OAuth users)
    if (user.password) {
      const isValid = await comparePassword(password, user.password);
      if (!isValid) {
        throw new AppError('Invalid password', 400);
      }
    }

    // Check if user owns any organizations with other members
    for (const org of user.ownedOrganizations) {
      const memberCount = await prisma.organizationMember.count({
        where: { organizationId: org.id },
      });

      if (memberCount > 1) {
        throw new AppError(
          `Cannot delete account. Please transfer ownership of "${org.name}" first.`,
          400
        );
      }
    }

    // Log deletion reason
    if (reason) {
      await prisma.activityLog.create({
        data: {
          userId,
          action: 'DELETE',
          metadata: { reason },
        },
      });
    }

    // Delete user and all related data (cascades)
    await prisma.$transaction(async (tx) => {
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
  async getUserById(userId: string): Promise<UserProfile> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return formatUserProfile(user);
  }
}

// Export singleton instance
export const usersService = new UsersService();