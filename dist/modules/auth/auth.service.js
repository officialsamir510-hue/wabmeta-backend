"use strict";
// src/modules/auth/auth.service.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = exports.AuthService = void 0;
const database_1 = __importDefault(require("../../config/database"));
const config_1 = require("../../config");
const password_1 = require("../../utils/password");
const jwt_1 = require("../../utils/jwt");
const email_resend_1 = require("../../utils/email.resend");
const otp_1 = require("../../utils/otp");
const errorHandler_1 = require("../../middleware/errorHandler");
const google_auth_library_1 = require("google-auth-library");
// Google OAuth Client
const googleClient = new google_auth_library_1.OAuth2Client(config_1.config.google.clientId);
// In-memory OTP storage (Use Redis in production)
const otpStore = new Map();
// ============================================
// HELPER FUNCTIONS
// ============================================
const normalizeEmail = (email) => email.trim().toLowerCase();
// ✅ Non-blocking email helper (never blocks request)
const sendEmailNonBlocking = (options) => {
    void (0, email_resend_1.sendEmail)(options)
        .then((ok) => {
        if (!ok)
            console.warn('📧 Email failed (sendEmail returned false):', options.subject);
    })
        .catch((err) => {
        console.error('📧 Email failed (promise rejected):', err);
    });
};
const formatUserResponse = (user) => ({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    avatar: user.avatar,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
});
const generateTokens = async (userId, email, organizationId) => {
    const payload = { userId, email, organizationId };
    const accessToken = (0, jwt_1.generateAccessToken)(payload);
    const refreshToken = (0, jwt_1.generateRefreshToken)(payload);
    // Store refresh token in database
    const expiresAt = new Date(Date.now() + (0, jwt_1.parseExpiryTime)(config_1.config.jwt.refreshExpiresIn));
    await database_1.default.refreshToken.create({
        data: {
            token: refreshToken,
            userId,
            expiresAt,
        },
    });
    return {
        accessToken,
        refreshToken,
        expiresIn: (0, jwt_1.parseExpiryTime)(config_1.config.jwt.expiresIn),
    };
};
const getDefaultOrganization = async (userId) => {
    // First check owned organizations
    const ownedOrg = await database_1.default.organization.findFirst({
        where: { ownerId: userId },
        select: { id: true, name: true, slug: true, planType: true },
    });
    if (ownedOrg)
        return ownedOrg;
    // Then check memberships
    const membership = await database_1.default.organizationMember.findFirst({
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
class AuthService {
    // ==========================================
    // REGISTER
    // ==========================================
    async register(input) {
        const { email, password, firstName, lastName, phone, organizationName } = input;
        const normalizedEmail = normalizeEmail(email);
        // Check if user already exists
        const existingUser = await database_1.default.user.findUnique({
            where: { email: normalizedEmail },
        });
        // ✅ If email exists, handle verified/unverified cases
        if (existingUser) {
            // If user exists but not verified, resend verification email
            if (!existingUser.emailVerified) {
                const emailVerifyToken = (0, otp_1.generateToken)();
                const emailVerifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
                await database_1.default.user.update({
                    where: { id: existingUser.id },
                    data: { emailVerifyToken, emailVerifyExpires },
                });
                const verifyUrl = `${config_1.config.frontendUrl}/verify-email?token=${emailVerifyToken}`;
                const emailContent = email_resend_1.emailTemplates.verifyEmail(existingUser.firstName, verifyUrl);
                // ✅ Non-blocking email send (no await)
                sendEmailNonBlocking({
                    to: normalizedEmail,
                    subject: emailContent.subject,
                    html: emailContent.html,
                });
                throw new errorHandler_1.AppError('Email already registered. Verification email resent.', 409);
            }
            // If already verified, just block
            throw new errorHandler_1.AppError('Email already registered', 409);
        }
        // Hash password
        const hashedPassword = await (0, password_1.hashPassword)(password);
        // Generate email verification token
        const emailVerifyToken = (0, otp_1.generateToken)();
        const emailVerifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        // Create user and organization in transaction
        const result = await database_1.default.$transaction(async (tx) => {
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
                        slug: (0, otp_1.generateSlug)(organizationName),
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
                    throw new errorHandler_1.AppError('FREE plan not found. Please run db:seed.', 500);
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
        const verifyUrl = `${config_1.config.frontendUrl}/verify-email?token=${emailVerifyToken}`;
        const emailContent = email_resend_1.emailTemplates.verifyEmail(firstName, verifyUrl);
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
    async login(input) {
        const normalizedEmail = normalizeEmail(input.email);
        const { password } = input;
        // Find user
        const user = await database_1.default.user.findUnique({
            where: { email: normalizedEmail },
        });
        if (!user) {
            throw new errorHandler_1.AppError('Invalid email or password', 401);
        }
        // Check if user has password (not OAuth only user)
        if (!user.password) {
            throw new errorHandler_1.AppError('Please login with Google', 400);
        }
        // Verify password
        const isValidPassword = await (0, password_1.comparePassword)(password, user.password);
        if (!isValidPassword) {
            throw new errorHandler_1.AppError('Invalid email or password', 401);
        }
        // Check user status
        if (user.status === 'SUSPENDED') {
            throw new errorHandler_1.AppError('Account suspended. Please contact support.', 403);
        }
        // Get default organization
        const organization = await getDefaultOrganization(user.id);
        // Update last login
        await database_1.default.user.update({
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
    async verifyEmail(token) {
        const user = await database_1.default.user.findFirst({
            where: {
                emailVerifyToken: token,
                emailVerifyExpires: { gt: new Date() },
            },
        });
        if (!user) {
            throw new errorHandler_1.AppError('Invalid or expired verification token', 400);
        }
        await database_1.default.user.update({
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
    async resendVerificationEmail(email) {
        const normalizedEmail = normalizeEmail(email);
        const user = await database_1.default.user.findUnique({
            where: { email: normalizedEmail },
        });
        if (!user) {
            // Don't reveal if user exists
            return { message: 'If your email is registered, you will receive a verification link' };
        }
        if (user.emailVerified) {
            throw new errorHandler_1.AppError('Email is already verified', 400);
        }
        // Generate new token
        const emailVerifyToken = (0, otp_1.generateToken)();
        const emailVerifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await database_1.default.user.update({
            where: { id: user.id },
            data: {
                emailVerifyToken,
                emailVerifyExpires,
            },
        });
        // Send email (✅ non-blocking)
        const verifyUrl = `${config_1.config.frontendUrl}/verify-email?token=${emailVerifyToken}`;
        const emailContent = email_resend_1.emailTemplates.verifyEmail(user.firstName, verifyUrl);
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
    async forgotPassword(email) {
        const normalizedEmail = normalizeEmail(email);
        const user = await database_1.default.user.findUnique({
            where: { email: normalizedEmail },
        });
        // Always return success message (security)
        const successMessage = 'If your email is registered, you will receive a password reset link';
        if (!user) {
            return { message: successMessage };
        }
        // Generate reset token
        const resetToken = (0, otp_1.generateToken)();
        const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        await database_1.default.user.update({
            where: { id: user.id },
            data: {
                passwordResetToken: resetToken,
                passwordResetExpires: resetExpires,
            },
        });
        // Send email (✅ non-blocking)
        const resetUrl = `${config_1.config.frontendUrl}/reset-password?token=${resetToken}`;
        const emailContent = email_resend_1.emailTemplates.resetPassword(user.firstName, resetUrl);
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
    async resetPassword(token, newPassword) {
        const user = await database_1.default.user.findFirst({
            where: {
                passwordResetToken: token,
                passwordResetExpires: { gt: new Date() },
            },
        });
        if (!user) {
            throw new errorHandler_1.AppError('Invalid or expired reset token', 400);
        }
        // Hash new password
        const hashedPassword = await (0, password_1.hashPassword)(newPassword);
        // Update password and clear reset token
        await database_1.default.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                passwordResetToken: null,
                passwordResetExpires: null,
            },
        });
        // Invalidate all refresh tokens
        await database_1.default.refreshToken.deleteMany({
            where: { userId: user.id },
        });
        return { message: 'Password reset successfully' };
    }
    // ==========================================
    // SEND OTP
    // ==========================================
    async sendOTP(email) {
        const normalizedEmail = normalizeEmail(email);
        const user = await database_1.default.user.findUnique({
            where: { email: normalizedEmail },
        });
        if (!user) {
            throw new errorHandler_1.AppError('User not found', 404);
        }
        // Generate OTP
        const otp = (0, otp_1.generateOTP)(6);
        const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
        // Store OTP (Use Redis in production)
        otpStore.set(normalizedEmail, {
            otp,
            expiresAt,
            attempts: 0,
        });
        // Send OTP email (✅ non-blocking)
        const emailContent = email_resend_1.emailTemplates.otp(user.firstName, otp);
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
    async verifyOTP(email, otp) {
        const normalizedEmail = normalizeEmail(email);
        const storedOTP = otpStore.get(normalizedEmail);
        if (!storedOTP) {
            throw new errorHandler_1.AppError('OTP expired or not found', 400);
        }
        // Check expiry
        if (Date.now() > storedOTP.expiresAt) {
            otpStore.delete(normalizedEmail);
            throw new errorHandler_1.AppError('OTP expired', 400);
        }
        // Check attempts
        if (storedOTP.attempts >= 5) {
            otpStore.delete(normalizedEmail);
            throw new errorHandler_1.AppError('Too many attempts. Please request a new OTP', 429);
        }
        // Verify OTP
        if (storedOTP.otp !== otp) {
            storedOTP.attempts++;
            throw new errorHandler_1.AppError('Invalid OTP', 400);
        }
        // Clear OTP
        otpStore.delete(normalizedEmail);
        // Get user
        const user = await database_1.default.user.findUnique({
            where: { email: normalizedEmail },
        });
        if (!user) {
            throw new errorHandler_1.AppError('User not found', 404);
        }
        // Mark email as verified if not already
        if (!user.emailVerified) {
            await database_1.default.user.update({
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
    async googleAuth(credential) {
        // Verify Google token (credential should be ID token / JWT)
        let payload;
        try {
            const ticket = await googleClient.verifyIdToken({
                idToken: credential,
                audience: config_1.config.google.clientId,
            });
            const ticketPayload = ticket.getPayload();
            if (!ticketPayload) {
                throw new Error('Invalid token payload');
            }
            payload = ticketPayload;
        }
        catch (error) {
            throw new errorHandler_1.AppError('Invalid Google token', 401);
        }
        const { email, given_name, family_name, picture, sub: googleId } = payload;
        const normalizedEmail = normalizeEmail(email);
        // Find or create user
        let user = await database_1.default.user.findUnique({
            where: { email: normalizedEmail },
        });
        if (user) {
            // Update Google ID if not set
            if (!user.googleId) {
                user = await database_1.default.user.update({
                    where: { id: user.id },
                    data: {
                        googleId,
                        avatar: user.avatar || picture,
                        emailVerified: true,
                        status: 'ACTIVE',
                    },
                });
            }
        }
        else {
            // Create new user
            user = await database_1.default.user.create({
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
            const organization = await database_1.default.organization.create({
                data: {
                    name: `${given_name}'s Workspace`,
                    slug: (0, otp_1.generateSlug)(`${given_name}-workspace`),
                    ownerId: user.id,
                    planType: 'FREE',
                },
            });
            await database_1.default.organizationMember.create({
                data: {
                    organizationId: organization.id,
                    userId: user.id,
                    role: 'OWNER',
                    joinedAt: new Date(),
                },
            });
        }
        // Update last login
        await database_1.default.user.update({
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
    async refreshToken(refreshToken) {
        // Verify refresh token
        let payload;
        try {
            payload = (0, jwt_1.verifyRefreshToken)(refreshToken);
        }
        catch (error) {
            throw new errorHandler_1.AppError('Invalid refresh token', 401);
        }
        // Check if token exists in database
        const storedToken = await database_1.default.refreshToken.findUnique({
            where: { token: refreshToken },
            include: { user: true },
        });
        if (!storedToken) {
            throw new errorHandler_1.AppError('Refresh token not found', 401);
        }
        if (storedToken.expiresAt < new Date()) {
            await database_1.default.refreshToken.delete({ where: { id: storedToken.id } });
            throw new errorHandler_1.AppError('Refresh token expired', 401);
        }
        // Delete old refresh token
        await database_1.default.refreshToken.delete({ where: { id: storedToken.id } });
        // Get organization
        const organization = await getDefaultOrganization(storedToken.userId);
        // Generate new tokens
        const tokens = await generateTokens(storedToken.userId, storedToken.user.email, organization?.id);
        return tokens;
    }
    // ==========================================
    // LOGOUT
    // ==========================================
    async logout(refreshToken) {
        // Delete refresh token from database
        await database_1.default.refreshToken.deleteMany({
            where: { token: refreshToken },
        });
        return { message: 'Logged out successfully' };
    }
    // ==========================================
    // LOGOUT ALL DEVICES
    // ==========================================
    async logoutAll(userId) {
        await database_1.default.refreshToken.deleteMany({
            where: { userId },
        });
        return { message: 'Logged out from all devices' };
    }
    // ==========================================
    // GET CURRENT USER
    // ==========================================
    async getCurrentUser(userId) {
        const user = await database_1.default.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            throw new errorHandler_1.AppError('User not found', 404);
        }
        return formatUserResponse(user);
    }
    // ==========================================
    // CHANGE PASSWORD
    // ==========================================
    async changePassword(userId, currentPassword, newPassword) {
        const user = await database_1.default.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            throw new errorHandler_1.AppError('User not found', 404);
        }
        if (!user.password) {
            throw new errorHandler_1.AppError('Cannot change password for OAuth accounts', 400);
        }
        // Verify current password
        const isValid = await (0, password_1.comparePassword)(currentPassword, user.password);
        if (!isValid) {
            throw new errorHandler_1.AppError('Current password is incorrect', 400);
        }
        // Hash and update new password
        const hashedPassword = await (0, password_1.hashPassword)(newPassword);
        await database_1.default.user.update({
            where: { id: userId },
            data: { password: hashedPassword },
        });
        // Invalidate all refresh tokens
        await database_1.default.refreshToken.deleteMany({
            where: { userId },
        });
        return { message: 'Password changed successfully' };
    }
}
exports.AuthService = AuthService;
// Export singleton instance
exports.authService = new AuthService();
//# sourceMappingURL=auth.service.js.map