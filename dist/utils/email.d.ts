interface EmailTemplateResult {
    subject: string;
    html: string;
}
interface SendEmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
}
export declare const emailTemplates: {
    verifyEmail: (name: string, verifyUrl: string) => EmailTemplateResult;
    verification: (name: string, verifyUrl: string) => EmailTemplateResult;
    resetPassword: (name: string, resetUrl: string) => EmailTemplateResult;
    passwordReset: (name: string, resetUrl: string) => EmailTemplateResult;
    otp: (name: string, otp: string) => EmailTemplateResult;
    welcome: (name: string, dashboardUrl?: string) => EmailTemplateResult;
    teamInvitation: (inviterName: string, organizationName: string, inviteUrl: string) => EmailTemplateResult;
    loginAlert: (name: string, loginInfo: {
        ip?: string;
        device?: string;
        time?: string;
    }) => EmailTemplateResult;
};
export declare const sendEmail: (options: SendEmailOptions) => Promise<boolean>;
export declare const sendTemplateEmail: (to: string, template: EmailTemplateResult) => Promise<boolean>;
export declare const sendVerificationEmail: (to: string, name: string, token: string) => Promise<boolean>;
export declare const sendPasswordResetEmail: (to: string, name: string, token: string) => Promise<boolean>;
export declare const sendOTPEmail: (to: string, name: string, otp: string) => Promise<boolean>;
export declare const sendWelcomeEmail: (to: string, name: string) => Promise<boolean>;
export declare const sendTeamInvitationEmail: (to: string, inviterName: string, organizationName: string, inviteToken: string) => Promise<boolean>;
export declare const verifyEmailConnection: () => Promise<boolean>;
declare const _default: {
    sendEmail: (options: SendEmailOptions) => Promise<boolean>;
    sendTemplateEmail: (to: string, template: EmailTemplateResult) => Promise<boolean>;
    sendVerificationEmail: (to: string, name: string, token: string) => Promise<boolean>;
    sendPasswordResetEmail: (to: string, name: string, token: string) => Promise<boolean>;
    sendOTPEmail: (to: string, name: string, otp: string) => Promise<boolean>;
    sendWelcomeEmail: (to: string, name: string) => Promise<boolean>;
    sendTeamInvitationEmail: (to: string, inviterName: string, organizationName: string, inviteToken: string) => Promise<boolean>;
    verifyEmailConnection: () => Promise<boolean>;
    emailTemplates: {
        verifyEmail: (name: string, verifyUrl: string) => EmailTemplateResult;
        verification: (name: string, verifyUrl: string) => EmailTemplateResult;
        resetPassword: (name: string, resetUrl: string) => EmailTemplateResult;
        passwordReset: (name: string, resetUrl: string) => EmailTemplateResult;
        otp: (name: string, otp: string) => EmailTemplateResult;
        welcome: (name: string, dashboardUrl?: string) => EmailTemplateResult;
        teamInvitation: (inviterName: string, organizationName: string, inviteUrl: string) => EmailTemplateResult;
        loginAlert: (name: string, loginInfo: {
            ip?: string;
            device?: string;
            time?: string;
        }) => EmailTemplateResult;
    };
};
export default _default;
//# sourceMappingURL=email.d.ts.map