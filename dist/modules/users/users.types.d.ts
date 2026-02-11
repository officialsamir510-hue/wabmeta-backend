import { User, UserStatus } from '@prisma/client';
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
export type SafeUser = Omit<User, 'password' | 'emailVerifyToken' | 'emailVerifyExpires' | 'passwordResetToken' | 'passwordResetExpires' | 'otpSecret'>;
//# sourceMappingURL=users.types.d.ts.map