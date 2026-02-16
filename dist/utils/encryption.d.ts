/**
 * Validate encryption key
 */
export declare function validateEncryptionKey(): boolean;
/**
 * Encrypt a string value
 */
export declare function encrypt(text: string): string;
/**
 * Decrypt an encrypted string
 */
export declare function decrypt(encryptedText: string): string | null;
/**
 * Safe decrypt - returns null instead of throwing
 */
export declare function safeDecrypt(encryptedText: string): string | null;
/**
 * Strict decrypt - only returns valid Meta tokens
 */
export declare function safeDecryptStrict(encryptedText: string): string | null;
/**
 * Check if a string is a Meta access token
 */
export declare function isMetaToken(value: string): boolean;
/**
 * Mask a token for logging
 */
export declare function maskToken(token: string): string;
/**
 * Check if a string is encrypted (our format)
 */
export declare function isEncrypted(value: string): boolean;
/**
 * Encrypt if not already encrypted
 */
export declare function encryptIfNeeded(text: string): string;
export declare function hashSHA256(value: string): string;
export declare function hmacSHA256(value: string, secret: string): string;
export declare function generateSecureToken(length?: number): string;
export declare function secureCompare(a: string, b: string): boolean;
export declare function verifyWebhookSignature(payload: string, signature: string, appSecret: string): boolean;
export declare function generateApiKeyPair(): {
    key: string;
    secret: string;
};
export declare function hashApiSecret(secret: string): string;
export declare function verifyApiSecret(secret: string, hash: string): boolean;
declare const _default: {
    encrypt: typeof encrypt;
    decrypt: typeof decrypt;
    safeDecrypt: typeof safeDecrypt;
    safeDecryptStrict: typeof safeDecryptStrict;
    isMetaToken: typeof isMetaToken;
    maskToken: typeof maskToken;
    isEncrypted: typeof isEncrypted;
    encryptIfNeeded: typeof encryptIfNeeded;
    validateEncryptionKey: typeof validateEncryptionKey;
    hashSHA256: typeof hashSHA256;
    hmacSHA256: typeof hmacSHA256;
    generateSecureToken: typeof generateSecureToken;
    secureCompare: typeof secureCompare;
    verifyWebhookSignature: typeof verifyWebhookSignature;
    generateApiKeyPair: typeof generateApiKeyPair;
    hashApiSecret: typeof hashApiSecret;
    verifyApiSecret: typeof verifyApiSecret;
};
export default _default;
//# sourceMappingURL=encryption.d.ts.map