// src/modules/users/users.types.ts

import { User, UserStatus } from '@prisma/client';

// ============================================
// REQUEST TYPES
// ============================================

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatar?: string;
}

export interface UpdateAvatarInput {
  avatar: string;
}

export interface UpdateNotificationSettingsInput {
  emailNotifications?: boolean;
  pushNotifications?: boolean;
  smsNotifications?: boolean;
  marketingEmails?: boolean;
}

export interface DeleteAccountInput {
  password: string;
  reason?: string;
}

// ============================================
// RESPONSE TYPES
// ============================================

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  avatar: string | null;
  status: UserStatus;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserWithOrganizations extends UserProfile {
  organizations: {
    id: string;
    name: string;
    slug: string;
    role: string;
    isOwner: boolean;
  }[];
}

export interface UserStats {
  totalMessages: number;
  totalContacts: number;
  totalCampaigns: number;
  memberSince: Date;
}

export interface SessionInfo {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date;
  expiresAt: Date;
  isCurrent: boolean;
}

// ============================================
// INTERNAL TYPES
// ============================================

export type SafeUser = Omit<User, 'password' | 'emailVerifyToken' | 'emailVerifyExpires' | 'passwordResetToken' | 'passwordResetExpires' | 'otpSecret'>;