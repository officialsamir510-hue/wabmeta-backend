/**
 * Encrypt a string value
 * @param text Plain text to encrypt
 * @returns Encrypted string (base64)
 */
export declare function encrypt(text: string): string;
/**
 * Decrypt an encrypted string
 * @param encryptedText Encrypted string
 * @returns Decrypted plain text or null if failed
 */
export declare function decrypt(encryptedText: string): string | null;
/**
 * Safe decrypt - returns null instead of throwing
 */
export declare function safeDecrypt(encryptedText: string): string | null;
/**
 * Strict decrypt - only returns valid Meta tokens
 * ✅ Use this for Meta access tokens
 */
export declare function safeDecryptStrict(encryptedText: string): string | null;
/**
 * Check if a string is a Meta access token
 * Meta tokens start with "EAA" and are typically 150-300 characters
 */
export declare function isMetaToken(value: string): boolean;
/**
 * Mask a token for logging (show first and last 8 chars)
 */
export declare function maskToken(token: string): string;
/**
 * Check if a string is encrypted (our format)
 */
export declare function isEncrypted(value: string): boolean;
/**
 * Create SHA256 hash
 */
export declare function hashSHA256(value: string): string;
/**
 * Create HMAC SHA256
 */
export declare function hmacSHA256(value: string, secret: string): string;
/**
 * Generate random token
 */
export declare function generateSecureToken(length?: number): string;
/**
 * Compare two strings in constant time (prevent timing attacks)
 */
export declare function secureCompare(a: string, b: string): boolean;
/**
 * Verify Meta webhook signature
 */
export declare function verifyWebhookSignature(payload: string, signature: string, appSecret: string): boolean;
/**
 * Generate API key pair
 */
export declare function generateApiKeyPair(): {
    key: string;
    secret: string;
};
/**
 * Hash API secret for storage
 */
export declare function hashApiSecret(secret: string): string;
/**
 * Verify API secret
 */
export declare function verifyApiSecret(secret: string, hash: string): boolean;
declare const _default: {
    encrypt: typeof encrypt;
    decrypt: typeof decrypt;
    safeDecrypt: typeof safeDecrypt;
    safeDecryptStrict: typeof safeDecryptStrict;
    isMetaToken: typeof isMetaToken;
    maskToken: typeof maskToken;
    isEncrypted: typeof isEncrypted;
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