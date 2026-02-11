"use strict";
// src/modules/auth/auth.controller.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = exports.AuthController = void 0;
const auth_service_1 = require("./auth.service");
const response_1 = require("../../utils/response");
const cookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax'),
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
});
class AuthController {
    async register(req, res, next) {
        try {
            const input = req.body;
            const result = await auth_service_1.authService.register(input);
            res.cookie('refreshToken', result.tokens.refreshToken, cookieOptions());
            return (0, response_1.sendSuccess)(res, result, 'Registration successful', 201);
        }
        catch (error) {
            next(error);
        }
    }
    async login(req, res, next) {
        try {
            const input = req.body;
            const result = await auth_service_1.authService.login(input);
            res.cookie('refreshToken', result.tokens.refreshToken, cookieOptions());
            return (0, response_1.sendSuccess)(res, result, 'Login successful');
        }
        catch (error) {
            next(error);
        }
    }
    async verifyEmail(req, res, next) {
        try {
            const { token } = req.body;
            const result = await auth_service_1.authService.verifyEmail(token);
            return (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    async resendVerification(req, res, next) {
        try {
            const { email } = req.body;
            const result = await auth_service_1.authService.resendVerificationEmail(email);
            return (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    async forgotPassword(req, res, next) {
        try {
            const { email } = req.body;
            const result = await auth_service_1.authService.forgotPassword(email);
            return (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    async resetPassword(req, res, next) {
        try {
            const { token, password } = req.body;
            const result = await auth_service_1.authService.resetPassword(token, password);
            return (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    async sendOTP(req, res, next) {
        try {
            const { email } = req.body;
            const result = await auth_service_1.authService.sendOTP(email);
            return (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    async verifyOTP(req, res, next) {
        try {
            const { email, otp } = req.body;
            const result = await auth_service_1.authService.verifyOTP(email, otp);
            res.cookie('refreshToken', result.tokens.refreshToken, cookieOptions());
            return (0, response_1.sendSuccess)(res, result, 'OTP verified successfully');
        }
        catch (error) {
            next(error);
        }
    }
    async googleAuth(req, res, next) {
        try {
            const { credential } = req.body;
            const result = await auth_service_1.authService.googleAuth(credential);
            res.cookie('refreshToken', result.tokens.refreshToken, cookieOptions());
            return (0, response_1.sendSuccess)(res, result, 'Google authentication successful');
        }
        catch (error) {
            next(error);
        }
    }
    async refreshToken(req, res, next) {
        try {
            const refreshToken = req.cookies.refreshToken || req.body?.refreshToken;
            if (!refreshToken) {
                return res.status(401).json({
                    success: false,
                    error: 'Refresh token required',
                });
            }
            const tokens = await auth_service_1.authService.refreshToken(refreshToken);
            res.cookie('refreshToken', tokens.refreshToken, cookieOptions());
            return (0, response_1.sendSuccess)(res, tokens, 'Token refreshed');
        }
        catch (error) {
            next(error);
        }
    }
    async logout(req, res, next) {
        try {
            const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
            if (refreshToken) {
                await auth_service_1.authService.logout(refreshToken);
            }
            res.clearCookie('refreshToken', cookieOptions());
            return (0, response_1.sendSuccess)(res, null, 'Logged out successfully');
        }
        catch (error) {
            next(error);
        }
    }
    async logoutAll(req, res, next) {
        try {
            const userId = req.user.id;
            const result = await auth_service_1.authService.logoutAll(userId);
            res.clearCookie('refreshToken', cookieOptions());
            return (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
    async me(req, res, next) {
        try {
            const userId = req.user.id;
            const user = await auth_service_1.authService.getCurrentUser(userId);
            return (0, response_1.sendSuccess)(res, user, 'User fetched successfully');
        }
        catch (error) {
            next(error);
        }
    }
    async changePassword(req, res, next) {
        try {
            const userId = req.user.id;
            const { currentPassword, newPassword } = req.body;
            const result = await auth_service_1.authService.changePassword(userId, currentPassword, newPassword);
            res.clearCookie('refreshToken', cookieOptions());
            return (0, response_1.sendSuccess)(res, result, result.message);
        }
        catch (error) {
            next(error);
        }
    }
}
exports.AuthController = AuthController;
exports.authController = new AuthController();
//# sourceMappingURL=auth.controller.js.map