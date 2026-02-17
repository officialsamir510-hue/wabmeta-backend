// src/modules/auth/auth.service.ts

import prisma from '../../config/database';
import { config } from '../../config';
import { hashPassword, comparePassword } from '../../utils/password';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  parseExpiryTime,
} from '../../utils/jwt';
import { sendEmail, emailTemplates } from '../../utils/email.resend';
import { generateOTP, generateToken, generateSlug } from '../../utils/otp';
import { AppError } from '../../middleware/errorHandler';
import {
  RegisterInput,
  LoginInput,
  AuthResponse,
  AuthUser,
  AuthTokens,
  GoogleUserPayload,
  OTPData,
} from './auth.types';
import { OAuth2Client } from 'google-auth-library';

// Google OAuth Client
const googleClient = new OAuth2Client(config.google.clientId);

// In-memory OTP storage (Use Redis in production)
const otpStore = new Map<string, OTPData>();

// ============================================
// HELPER FUNCTIONS
// ============================================

const normalizeEmail = (email: string) => email.trim().toLowerCase();

// ✅ Non-blocking email helper (never blocks request)
const sendEmailNonBlocking = (options: { to: string; subject: string; html: string }) => {
  void sendEmail(options)
    .then((ok) => {
      if (!ok) console.warn('📧 Email failed (sendEmail returned false):', options.subject);
    })
    .catch((err) => {
      console.error('📧 Email failed (promise rejected):', err);
    });
};

const formatUserResponse = (user: any): AuthUser => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  phone: user.phone,
  avatar: user.avatar,
  emailVerified: user.emailVerified,
  createdAt: user.createdAt,
});

const generateTokens = async (
  userId: string,
  email: string,
  organizationId?: string
): Promise<AuthTokens> => {
  const payload = { userId, email, organizationId };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  // Store refresh token in database
  const expiresAt = new Date(Date.now() + parseExpiryTime(config.jwt.refreshExpiresIn));

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId,
      expiresAt,
    },
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: parseExpiryTime(config.jwt.expiresIn),
  };
};

const getDefaultOrganization = async (userId: string) => {
  // First check owned organizations
  const ownedOrg = await prisma.organization.findFirst({
    where: { ownerId: userId },
    select: { id: true, name: true, slug: true, planType: true },
  });

  if (ownedOrg) return ownedOrg;

  // Then check memberships
  const membership = await prisma.organizationMember.findFirst({
    where: { userId },
    include: {
      organization: {
        select: { id: true, name: true, slug: true, planType: true },
      },
    },
  });

  return membership?.organization || null;
};

// ============================================
// AUTH SERVICE CLASS
// ============================================

export class AuthService {
  // ==========================================
  // REGISTER
  // ==========================================
  async register(input: RegisterInput): Promise<AuthResponse> {
    const { email, password, firstName, lastName, phone, organizationName } = input;
    const normalizedEmail = normalizeEmail(email);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // ✅ If email exists, handle verified/unverified cases
    if (existingUser) {
      // If user exists but not verified, resend verification email
      if (!existingUser.emailVerified) {
        const emailVerifyToken = generateToken();
        const emailVerifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        await prisma.user.update({
          where: { id: existingUser.id },
          data: { emailVerifyToken, emailVerifyExpires },
        });

        const verifyUrl = `${config.frontendUrl}/verify-email?token=${emailVerifyToken}`;
        const emailContent = emailTemplates.verifyEmail(existingUser.firstName, verifyUrl);

        // ✅ Non-blocking email send (no await)
        sendEmailNonBlocking({
          to: normalizedEmail,
          subject: emailContent.subject,
          html: emailContent.html,
        });

        throw new AppError('Email already registered. Verification email resent.', 409);
      }

      // If already verified, just block
      throw new AppError('Email already registered', 409);
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Generate email verification token
    const emailVerifyToken = generateToken();
    const emailVerifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user and organization in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          password: hashedPassword,
          firstName,
          lastName,
          phone,
          emailVerifyToken,
          emailVerifyExpires,
          status: 'PENDING_VERIFICATION',
        },
      });

      // Create organization if name provided (your current flow)
      let organization = null;

      if (organizationName && organizationName.trim().length > 0) {
        organization = await tx.organization.create({
          data: {
            name: organizationName.trim(),
            slug: generateSlug(organizationName),
            ownerId: user.id,
            planType: 'FREE',
          },
        });

        // Add user as organization member
        await tx.organizationMember.create({
          data: {
            organizationId: organization.id,
            userId: user.id,
            role: 'OWNER',
            joinedAt: new Date(),
          },
        });

        // Create free subscription
        const freePlan = await tx.plan.findUnique({ where: { type: 'FREE' } });
        if (!freePlan) {
          throw new AppError('FREE plan not found. Please run db:seed.', 500);
        }

        await tx.subscription.create({
          data: {
            organizationId: organization.id,
            planId: freePlan.id,
            status: 'ACTIVE',
            billingCycle: 'monthly',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });
      }

      return { user, organization };
    });

    // Send verification email (✅ non-blocking)
    const verifyUrl = `${config.frontendUrl}/verify-email?token=${emailVerifyToken}`;
    const emailContent = emailTemplates.verifyEmail(firstName, verifyUrl);

    sendEmailNonBlocking({
      to: normalizedEmail,
      subject: emailContent.subject,
      html: emailContent.html,
    });

    // Generate tokens
    const tokens = await generateTokens(result.user.id, result.user.email, result.organization?.id);

    return {
      user: formatUserResponse(result.user),
      tokens,
      organization: result.organization
        ? {
          id: result.organization.id,
          name: result.organization.name,
          slug: result.organization.slug,
          planType: result.organization.planType,
        }
        : undefined,
    };
  }

  // ==========================================
  // LOGIN
  // ==========================================
  async login(input: LoginInput): Promise<AuthResponse> {
    const normalizedEmail = normalizeEmail(input.email);
    const { password } = input;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    // Check if user has password (not OAuth only user)
    if (!user.password) {
      throw new AppError('Please login with Google', 400);
    }

    // Verify password
    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      throw new AppError('Invalid email or password', 401);
    }

    // Check user status
    if (user.status === 'SUSPENDED') {
      throw new AppError('Account suspended. Please contact support.', 403);
    }

    // Get default organization
    const organization = await getDefaultOrganization(user.id);

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
      },
    });

    // Generate tokens
    const tokens = await generateTokens(user.id, user.email, organization?.id);

    return {
      user: formatUserResponse(user),
      tokens,
      organization: organization || undefined,
    };
  }

  // ==========================================
  // VERIFY EMAIL
  // ==========================================
  async verifyEmail(token: string): Promise<{ message: string }> {
    const user = await prisma.user.findFirst({
      where: {
        emailVerifyToken: token,
        emailVerifyExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new AppError('Invalid or expired verification token', 400);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifyToken: null,
        emailVerifyExpires: null,
        status: 'ACTIVE',
      },
    });

    return { message: 'Email verified successfully' };
  }

  // ==========================================
  // RESEND VERIFICATION EMAIL
  // ==========================================
  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    const normalizedEmail = normalizeEmail(email);

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      // Don't reveal if user exists
      return { message: 'If your email is registered, you will receive a verification link' };
    }

    if (user.emailVerified) {
      throw new AppError('Email is already verified', 400);
    }

    // Generate new token
    const emailVerifyToken = generateToken();
    const emailVerifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifyToken,
        emailVerifyExpires,
      },
    });

    // Send email (✅ non-blocking)
    const verifyUrl = `${config.frontendUrl}/verify-email?token=${emailVerifyToken}`;
    const emailContent = emailTemplates.verifyEmail(user.firstName, verifyUrl);

    sendEmailNonBlocking({
      to: normalizedEmail,
      subject: emailContent.subject,
      html: emailContent.html,
    });

    return { message: 'Verification email sent' };
  }

  // ==========================================
  // FORGOT PASSWORD
  // ==========================================
  async forgotPassword(email: string): Promise<{ message: string }> {
    const normalizedEmail = normalizeEmail(email);

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Always return success message (security)
    const successMessage = 'If your email is registered, you will receive a password reset link';

    if (!user) {
      return { message: successMessage };
    }

    // Generate reset token
    const resetToken = generateToken();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      },
    });

    // Send email (✅ non-blocking)
    const resetUrl = `${config.frontendUrl}/reset-password?token=${resetToken}`;
    const emailContent = emailTemplates.resetPassword(user.firstName, resetUrl);

    sendEmailNonBlocking({
      to: normalizedEmail,
      subject: emailContent.subject,
      html: emailContent.html,
    });

    return { message: successMessage };
  }

  // ==========================================
  // RESET PASSWORD
  // ==========================================
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new AppError('Invalid or expired reset token', 400);
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    // Invalidate all refresh tokens
    await prisma.refreshToken.deleteMany({
      where: { userId: user.id },
    });

    return { message: 'Password reset successfully' };
  }

  // ==========================================
  // SEND OTP
  // ==========================================
  async sendOTP(email: string): Promise<{ message: string }> {
    const normalizedEmail = normalizeEmail(email);

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Generate OTP
    const otp = generateOTP(6);
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store OTP (Use Redis in production)
    otpStore.set(normalizedEmail, {
      otp,
      expiresAt,
      attempts: 0,
    });

    // Send OTP email (✅ non-blocking)
    const emailContent = emailTemplates.otp(user.firstName, otp);

    sendEmailNonBlocking({
      to: normalizedEmail,
      subject: emailContent.subject,
      html: emailContent.html,
    });

    return { message: 'OTP sent to your email' };
  }

  // ==========================================
  // VERIFY OTP
  // ==========================================
  async verifyOTP(email: string, otp: string): Promise<AuthResponse> {
    const normalizedEmail = normalizeEmail(email);

    const storedOTP = otpStore.get(normalizedEmail);

    if (!storedOTP) {
      throw new AppError('OTP expired or not found', 400);
    }

    // Check expiry
    if (Date.now() > storedOTP.expiresAt) {
      otpStore.delete(normalizedEmail);
      throw new AppError('OTP expired', 400);
    }

    // Check attempts
    if (storedOTP.attempts >= 5) {
      otpStore.delete(normalizedEmail);
      throw new AppError('Too many attempts. Please request a new OTP', 429);
    }

    // Verify OTP
    if (storedOTP.otp !== otp) {
      storedOTP.attempts++;
      throw new AppError('Invalid OTP', 400);
    }

    // Clear OTP
    otpStore.delete(normalizedEmail);

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Mark email as verified if not already
    if (!user.emailVerified) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          status: 'ACTIVE',
        },
      });
    }

    // Get organization
    const organization = await getDefaultOrganization(user.id);

    // Generate tokens
    const tokens = await generateTokens(user.id, user.email, organization?.id);

    return {
      user: formatUserResponse(user),
      tokens,
      organization: organization || undefined,
    };
  }

  // ==========================================
  // GOOGLE AUTH
  // ==========================================
  async googleAuth(credential: string): Promise<AuthResponse> {
    // Verify Google token (credential should be ID token / JWT)
    let payload: GoogleUserPayload;

    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: config.google.clientId,
      });

      const ticketPayload = ticket.getPayload();
      if (!ticketPayload) {
        throw new Error('Invalid token payload');
      }

      payload = ticketPayload as GoogleUserPayload;
    } catch (error) {
      throw new AppError('Invalid Google token', 401);
    }

    const { email, given_name, family_name, picture, sub: googleId } = payload;
    const normalizedEmail = normalizeEmail(email);

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (user) {
      // Update Google ID if not set
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleId,
            avatar: user.avatar || picture,
            emailVerified: true,
            status: 'ACTIVE',
          },
        });
      }
    } else {
      // Create new user
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          googleId,
          firstName: given_name,
          lastName: family_name,
          avatar: picture,
          emailVerified: true,
          status: 'ACTIVE',
        },
      });

      // Create default organization
      const organization = await prisma.organization.create({
        data: {
          name: `${given_name}'s Workspace`,
          slug: generateSlug(`${given_name}-workspace`),
          ownerId: user.id,
          planType: 'FREE',
        },
      });

      await prisma.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          role: 'OWNER',
          joinedAt: new Date(),
        },
      });
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Get organization
    const organization = await getDefaultOrganization(user.id);

    // Generate tokens
    const tokens = await generateTokens(user.id, user.email, organization?.id);

    return {
      user: formatUserResponse(user),
      tokens,
      organization: organization || undefined,
    };
  }

  // ==========================================
  // REFRESH TOKEN
  // ==========================================
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    // Verify refresh token
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (error) {
      throw new AppError('Invalid refresh token', 401);
    }

    // Check if token exists in database
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken) {
      throw new AppError('Refresh token not found', 401);
    }

    if (storedToken.expiresAt < new Date()) {
      await prisma.refreshToken.delete({ where: { id: storedToken.id } });
      throw new AppError('Refresh token expired', 401);
    }

    // Delete old refresh token
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });

    // Get organization
    const organization = await getDefaultOrganization(storedToken.userId);

    // Generate new tokens
    const tokens = await generateTokens(
      storedToken.userId,
      storedToken.user.email,
      organization?.id
    );

    return tokens;
  }

  // ==========================================
  // LOGOUT
  // ==========================================
  async logout(refreshToken: string): Promise<{ message: string }> {
    // Delete refresh token from database
    await prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });

    return { message: 'Logged out successfully' };
  }

  // ==========================================
  // LOGOUT ALL DEVICES
  // ==========================================
  async logoutAll(userId: string): Promise<{ message: string }> {
    await prisma.refreshToken.deleteMany({
      where: { userId },
    });

    return { message: 'Logged out from all devices' };
  }

  // ==========================================
  // GET CURRENT USER
  // ==========================================
  async getCurrentUser(userId: string): Promise<AuthUser> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return formatUserResponse(user);
  }

  // ==========================================
  // CHANGE PASSWORD
  // ==========================================
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ message: string }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (!user.password) {
      throw new AppError('Cannot change password for OAuth accounts', 400);
    }

    // Verify current password
    const isValid = await comparePassword(currentPassword, user.password);
    if (!isValid) {
      throw new AppError('Current password is incorrect', 400);
    }

    // Hash and update new password
    const hashedPassword = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Invalidate all refresh tokens
    await prisma.refreshToken.deleteMany({
      where: { userId },
    });

    return { message: 'Password changed successfully' };
  }
}

// Export singleton instance
export const authService = new AuthService();