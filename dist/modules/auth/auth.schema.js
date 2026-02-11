"use strict";
// src/modules/auth/auth.schema.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.resendVerificationSchema = exports.changePasswordSchema = exports.googleAuthSchema = exports.refreshTokenSchema = exports.resendOTPSchema = exports.verifyOTPSchema = exports.verifyEmailSchema = exports.resetPasswordSchema = exports.forgotPasswordSchema = exports.loginSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
// ============================================
// COMMON VALIDATORS
// ============================================
const emailSchema = zod_1.z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email address')
    .toLowerCase()
    .trim();
const passwordSchema = zod_1.z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password is too long')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number');
const nameSchema = zod_1.z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name is too long')
    .trim();
const phoneSchema = zod_1.z
    .string()
    .regex(/^\+?[1-9]\d{9,14}$/, 'Invalid phone number')
    .optional();
// ============================================
// REQUEST SCHEMAS
// ============================================
exports.registerSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: emailSchema,
        password: passwordSchema,
        firstName: nameSchema,
        lastName: nameSchema.optional(),
        phone: phoneSchema,
        organizationName: zod_1.z
            .string()
            .min(2, 'Organization name must be at least 2 characters')
            .max(100, 'Organization name is too long')
            .trim()
            .optional(),
    }),
});
exports.loginSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: emailSchema,
        password: zod_1.z.string().min(1, 'Password is required'),
    }),
});
exports.forgotPasswordSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: emailSchema,
    }),
});
exports.resetPasswordSchema = zod_1.z.object({
    body: zod_1.z.object({
        token: zod_1.z.string().min(1, 'Token is required'),
        password: passwordSchema,
    }),
});
exports.verifyEmailSchema = zod_1.z.object({
    body: zod_1.z.object({
        token: zod_1.z.string().min(1, 'Token is required'),
    }),
});
exports.verifyOTPSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: emailSchema,
        otp: zod_1.z
            .string()
            .length(6, 'OTP must be 6 digits')
            .regex(/^\d+$/, 'OTP must contain only numbers'),
    }),
});
exports.resendOTPSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: emailSchema,
    }),
});
exports.refreshTokenSchema = zod_1.z.object({
    body: zod_1.z.object({
        refreshToken: zod_1.z.string().min(1, 'Refresh token is required'),
    }),
});
exports.googleAuthSchema = zod_1.z.object({
    body: zod_1.z.object({
        credential: zod_1.z.string().min(1, 'Google credential is required'),
    }),
});
exports.changePasswordSchema = zod_1.z.object({
    body: zod_1.z.object({
        currentPassword: zod_1.z.string().min(1, 'Current password is required'),
        newPassword: passwordSchema,
    }),
});
exports.resendVerificationSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: emailSchema,
    }),
});
//# sourceMappingURL=auth.schema.js.map