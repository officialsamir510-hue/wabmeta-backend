/**
 * Validate encryption key configuration
 */
export declare function validateEncryptionKey(): boolean;
/**
 * Check if a string is already encrypted
 * Encrypted format: iv:authTag:encrypted
 */
export declare function isEncrypted(text: string): boolean;
/**
 * Encrypt a string value
 */
export declare function encrypt(text: string): string;
/**
 * Decrypt an encrypted string
 */
export declare function decrypt(encryptedText: string): string;
/**
 * Encrypt only if not already encrypted
 */
export declare function encryptIfNeeded(text: string): string;
/**
 * Safely decrypt - returns null if fails
 */
export declare function safeDecrypt(encryptedText: string): string | null;
/**
 * Check if a token looks like a Meta access token
 */
export declare function isMetaToken(value: string): boolean;
/**
 * Check if a token looks like a Page access token
 */
export declare function isPageToken(value: string): boolean;
/**
 * Decrypt and verify it's a valid Meta token
 */
export declare function safeDecryptStrict(encryptedText: string): string | null;
/**
 * Mask sensitive data for logging
 */
export declare function maskToken(token: string): string;
/**
 * Mask phone number for logging
 */
export declare function maskPhone(phone: string): string;
/**
 * Generate a random webhook secret
 */
export declare function generateWebhookSecret(): string;
/**
 * Verify webhook signature from Meta
 */
export declare function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean;
declare const _default: {
    validateEncryptionKey: typeof validateEncryptionKey;
    isEncrypted: typeof isEncrypted;
    encrypt: typeof encrypt;
    decrypt: typeof decrypt;
    encryptIfNeeded: typeof encryptIfNeeded;
    safeDecrypt: typeof safeDecrypt;
    isMetaToken: typeof isMetaToken;
    isPageToken: typeof isPageToken;
    safeDecryptStrict: typeof safeDecryptStrict;
    maskToken: typeof maskToken;
    maskPhone: typeof maskPhone;
    generateWebhookSecret: typeof generateWebhookSecret;
    verifyWebhookSignature: typeof verifyWebhookSignature;
};
export default _default;
//# sourceMappingURL=encryption.d.ts.map