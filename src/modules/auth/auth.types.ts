// src/modules/auth/auth.types.ts

import { User, Organization } from '@prisma/client';

// ============================================
// REQUEST TYPES
// ============================================

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  organizationName?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  token: string;
  password: string;
}

export interface VerifyEmailInput {
  token: string;
}

export interface VerifyOTPInput {
  email: string;
  otp: string;
}

export interface ResendOTPInput {
  email: string;
}

export interface RefreshTokenInput {
  refreshToken: string;
}

export interface GoogleAuthInput {
  credential: string; // Google ID token
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

// ============================================
// RESPONSE TYPES
// ============================================

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  avatar: string | null;
  emailVerified: boolean;
  createdAt: Date;
}

export interface AuthResponse {
  user: AuthUser;
  tokens: AuthTokens;
  organization?: {
    id: string;
    name: string;
    slug: string;
    planType: string;
  };
}

export interface MessageResponse {
  message: string;
}

// ============================================
// INTERNAL TYPES
// ============================================

export interface UserWithOrganization extends User {
  ownedOrganizations: Organization[];
  memberships: {
    organization: Organization;
    role: string;
  }[];
}

export interface OTPData {
  otp: string;
  expiresAt: number;
  attempts: number;
}

// Google OAuth payload
export interface GoogleUserPayload {
  email: string;
  email_verified: boolean;
  name: string;
  given_name: string;
  family_name?: string;
  picture?: string;
  sub: string; // Google user ID
}