// src/utils/email.ts

import nodemailer from 'nodemailer';
import { config } from '../config';

// Create transporter
const transporter = nodemailer.createTransport({
  host: config.email.smtp.host,
  port: config.email.smtp.port,
  secure: config.email.smtp.port === 465,
  auth: { user: config.email.smtp.auth.user, pass: config.email.smtp.auth.pass },

  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 20000,
});

// Email template result interface
interface EmailTemplateResult {
  subject: string;
  html: string;
}

// Email sending interface
interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// ✅ Email Templates Object - Matching auth.service.ts expectations
export const emailTemplates = {
  // Verify Email Template
  verifyEmail: (name: string, verifyUrl: string): EmailTemplateResult => ({
    subject: '🔐 Verify your WabMeta account',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #25D366 0%, #128C7E 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #25D366; color: white !important; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
          .link-box { word-break: break-all; background: #eee; padding: 10px; border-radius: 5px; font-size: 14px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to WabMeta!</h1>
          </div>
          <div class="content">
            <h2>Hi ${name},</h2>
            <p>Thank you for signing up! Please verify your email address to get started.</p>
            <p style="text-align: center;">
              <a href="${verifyUrl}" class="button">Verify Email Address</a>
            </p>
            <p>Or copy and paste this link in your browser:</p>
            <p class="link-box">${verifyUrl}</p>
            <p>This link will expire in 24 hours.</p>
            <p>If you didn't create an account, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} WabMeta. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  // Also keep 'verification' as alias for backward compatibility
  verification: (name: string, verifyUrl: string): EmailTemplateResult => {
    return emailTemplates.verifyEmail(name, verifyUrl);
  },

  // Reset Password Template
  resetPassword: (name: string, resetUrl: string): EmailTemplateResult => ({
    subject: '🔐 Reset your WabMeta password',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #25D366 0%, #128C7E 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #25D366; color: white !important; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
          .link-box { word-break: break-all; background: #eee; padding: 10px; border-radius: 5px; font-size: 14px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Password Reset</h1>
          </div>
          <div class="content">
            <h2>Hi ${name},</h2>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <p style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </p>
            <p>Or copy and paste this link in your browser:</p>
            <p class="link-box">${resetUrl}</p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} WabMeta. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  // Also keep 'passwordReset' as alias
  passwordReset: (name: string, resetUrl: string): EmailTemplateResult => {
    return emailTemplates.resetPassword(name, resetUrl);
  },

  // OTP Template
  otp: (name: string, otp: string): EmailTemplateResult => ({
    subject: `🔢 Your WabMeta OTP: ${otp}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #25D366 0%, #128C7E 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .otp-box { background: #25D366; color: white; font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 20px; text-align: center; border-radius: 10px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔢 Your OTP Code</h1>
          </div>
          <div class="content">
            <h2>Hi ${name},</h2>
            <p>Your one-time password (OTP) for WabMeta verification is:</p>
            <div class="otp-box">${otp}</div>
            <p>This code will expire in 10 minutes.</p>
            <p>If you didn't request this code, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} WabMeta. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  // Welcome Template
  welcome: (name: string, dashboardUrl?: string): EmailTemplateResult => ({
    subject: '🎉 Welcome to WabMeta!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #25D366 0%, #128C7E 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #25D366; color: white !important; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
          .features { margin: 20px 0; }
          .feature { margin: 10px 0; padding: 10px; background: white; border-radius: 5px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to WabMeta!</h1>
          </div>
          <div class="content">
            <h2>Hi ${name},</h2>
            <p>Your email has been verified! You're all set to start using WabMeta.</p>
            
            <div class="features">
              <h3>Here's what you can do:</h3>
              <div class="feature">📱 Connect your WhatsApp Business Account</div>
              <div class="feature">👥 Import and manage your contacts</div>
              <div class="feature">📢 Create and send broadcast campaigns</div>
              <div class="feature">🤖 Build automated chatbots</div>
            </div>
            
            <p style="text-align: center;">
              <a href="${dashboardUrl || config.frontendUrl + '/dashboard'}" class="button">Go to Dashboard</a>
            </p>
            
            <p>If you have any questions, feel free to reach out to our support team.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} WabMeta. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  // Team Invitation Template
  teamInvitation: (inviterName: string, organizationName: string, inviteUrl: string): EmailTemplateResult => ({
    subject: `👥 You've been invited to join ${organizationName} on WabMeta`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #25D366 0%, #128C7E 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #25D366; color: white !important; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>👥 Team Invitation</h1>
          </div>
          <div class="content">
            <h2>You've been invited!</h2>
            <p><strong>${inviterName}</strong> has invited you to join <strong>${organizationName}</strong> on WabMeta.</p>
            <p style="text-align: center;">
              <a href="${inviteUrl}" class="button">Accept Invitation</a>
            </p>
            <p>This invitation will expire in 7 days.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} WabMeta. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  // Login Alert Template
  loginAlert: (name: string, loginInfo: { ip?: string; device?: string; time?: string }): EmailTemplateResult => ({
    subject: '🔔 New login to your WabMeta account',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #25D366 0%, #128C7E 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .info-box { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔔 New Login Detected</h1>
          </div>
          <div class="content">
            <h2>Hi ${name},</h2>
            <p>We noticed a new login to your WabMeta account:</p>
            <div class="info-box">
              <p><strong>Time:</strong> ${loginInfo.time || new Date().toISOString()}</p>
              <p><strong>IP Address:</strong> ${loginInfo.ip || 'Unknown'}</p>
              <p><strong>Device:</strong> ${loginInfo.device || 'Unknown'}</p>
            </div>
            <p>If this was you, you can safely ignore this email.</p>
            <p>If you didn't log in, please change your password immediately and contact support.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} WabMeta. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),
};

// Send email function
export const sendEmail = async (options: SendEmailOptions): Promise<boolean> => {
  try {
    if (config.nodeEnv === 'test') {
      console.log('📧 [TEST MODE] Email would be sent:', options.subject);
      return true;
    }

    // Check if email config is set
    if (!config.email.smtp.auth.user || !config.email.smtp.auth.pass) {
      console.log('📧 [SKIP] Email not configured, skipping:', options.subject);
      return true; // Return true to not block the flow
    }

    await transporter.sendMail({
      from: config.email.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''),
    });

    console.log('📧 Email sent successfully to:', options.to);
    return true;
  } catch (error) {
    console.error('📧 Email sending failed:', error);
    // Don't throw error, just return false
    return false;
  }
};

// Helper function to send email with template result
export const sendTemplateEmail = async (
  to: string,
  template: EmailTemplateResult
): Promise<boolean> => {
  return sendEmail({
    to,
    subject: template.subject,
    html: template.html,
  });
};

// Send verification email
export const sendVerificationEmail = async (
  to: string,
  name: string,
  token: string
): Promise<boolean> => {
  const verifyUrl = `${config.frontendUrl}/verify-email?token=${token}`;
  const template = emailTemplates.verifyEmail(name, verifyUrl);
  return sendTemplateEmail(to, template);
};

// Send password reset email
export const sendPasswordResetEmail = async (
  to: string,
  name: string,
  token: string
): Promise<boolean> => {
  const resetUrl = `${config.frontendUrl}/reset-password?token=${token}`;
  const template = emailTemplates.resetPassword(name, resetUrl);
  return sendTemplateEmail(to, template);
};

// Send OTP email
export const sendOTPEmail = async (
  to: string,
  name: string,
  otp: string
): Promise<boolean> => {
  const template = emailTemplates.otp(name, otp);
  return sendTemplateEmail(to, template);
};

// Send welcome email
export const sendWelcomeEmail = async (
  to: string,
  name: string
): Promise<boolean> => {
  const template = emailTemplates.welcome(name);
  return sendTemplateEmail(to, template);
};

// Send team invitation email
export const sendTeamInvitationEmail = async (
  to: string,
  inviterName: string,
  organizationName: string,
  inviteToken: string
): Promise<boolean> => {
  const inviteUrl = `${config.frontendUrl}/accept-invite?token=${inviteToken}`;
  const template = emailTemplates.teamInvitation(inviterName, organizationName, inviteUrl);
  return sendTemplateEmail(to, template);
};

// Verify transporter connection
export const verifyEmailConnection = async (): Promise<boolean> => {
  try {
    if (!config.email.smtp.auth.user || !config.email.smtp.auth.pass) {
      console.log('📧 Email not configured, skipping verification');
      return true;
    }
    await transporter.verify();
    console.log('📧 Email server connection verified');
    return true;
  } catch (error) {
    console.error('📧 Email server connection failed:', error);
    return false;
  }
};
/* Duplicate transporter declaration removed */

export default {
  sendEmail,
  sendTemplateEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendOTPEmail,
  sendWelcomeEmail,
  sendTeamInvitationEmail,
  verifyEmailConnection,
  emailTemplates,
};
