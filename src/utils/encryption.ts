// src/utils/encryption.ts

import crypto from 'crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;

// Get encryption key from config
const DEFAULT_KEY = 'your-32-character-encryption-key!';
const ENCRYPTION_KEY = config.encryptionKey || config.encryption?.key || DEFAULT_KEY;

// Derive the key buffer properly
let KEY: Buffer;

try {
  if (ENCRYPTION_KEY.length === 64 && /^[0-9a-fA-F]+$/.test(ENCRYPTION_KEY)) {
    // If it's a 64-char hex string, use it as raw bytes
    KEY = Buffer.from(ENCRYPTION_KEY, 'hex');
  } else {
    // Otherwise treat as string and pad/truncate to 32 bytes
    KEY = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
  }
} catch (error) {
  console.error('Error deriving encryption key, falling back to empty key (unsafe)');
  KEY = Buffer.alloc(32);
}

/**
 * Validate encryption key configuration
 */
export function validateEncryptionKey(): boolean {
  const isDefault = ENCRYPTION_KEY === DEFAULT_KEY;
  const isProduction = config.nodeEnv === 'production';

  if (!ENCRYPTION_KEY) {
    console.error('❌ ENCRYPTION_KEY is missing!');
    return false;
  }

  if (ENCRYPTION_KEY.length < 32 && !isDefault) {
    console.warn('⚠️ ENCRYPTION_KEY is too short (should be at least 32 characters)');
    if (isProduction) return false;
  }

  if (isDefault) {
    console.warn('⚠️ Using default insecure ENCRYPTION_KEY!');
    if (isProduction) {
      console.error('❌ Cannot use default encryption key in production!');
      return false;
    }
  }

  console.log(`✅ Encryption key validated (${KEY.length} bytes)`);
  return true;
}

/**
 * Check if a string is already encrypted
 * Encrypted format: iv:authTag:encrypted
 */
export function isEncrypted(text: string): boolean {
  if (!text || typeof text !== 'string') return false;

  const parts = text.split(':');

  // Check if it has 3 parts and all are hex strings
  if (parts.length !== 3) return false;

  const [iv, authTag, encrypted] = parts;

  // Validate hex format and lengths
  const isValidHex = (str: string, expectedLength: number) => {
    const hexRegex = /^[0-9a-f]+$/i;
    return hexRegex.test(str) && str.length === expectedLength * 2;
  };

  return (
    isValidHex(iv, IV_LENGTH) &&
    isValidHex(authTag, AUTH_TAG_LENGTH) &&
    encrypted.length > 0
  );
}

/**
 * Encrypt a string value
 */
export function encrypt(text: string): string {
  if (!text) throw new Error('Cannot encrypt empty text');

  // If already encrypted, return as is
  if (isEncrypted(text)) {
    console.warn('⚠️ Text is already encrypted, returning as is');
    return text;
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt an encrypted string
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) throw new Error('Cannot decrypt empty text');

  // Check if it's encrypted format
  if (!isEncrypted(encryptedText)) {
    console.warn('⚠️ Text is not encrypted, returning as is');
    return encryptedText;
  }

  const parts = encryptedText.split(':');
  const [ivHex, authTagHex, encrypted] = parts;

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Encrypt only if not already encrypted
 */
export function encryptIfNeeded(text: string): string {
  if (!text) return text;

  if (isEncrypted(text)) {
    return text;
  }

  return encrypt(text);
}

/**
 * Safely decrypt - returns null if fails
 */
export function safeDecrypt(encryptedText: string): string | null {
  try {
    if (!encryptedText) return null;
    return decrypt(encryptedText);
  } catch (error: any) {
    console.error('Decryption failed:', error.message);
    return null;
  }
}

/**
 * Check if a token looks like a Meta access token
 */
export function isMetaToken(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  return value.startsWith('EAA') && value.length > 100;
}

/**
 * Check if a token looks like a Page access token
 */
export function isPageToken(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  return value.startsWith('EAA') && value.includes('|');
}

/**
 * Decrypt and verify it's a valid Meta token
 */
export function safeDecryptStrict(encryptedText: string): string | null {
  try {
    if (!encryptedText) return null;

    const decrypted = decrypt(encryptedText);

    // Check if it's a valid Meta/Facebook token
    if (!isMetaToken(decrypted) && !isPageToken(decrypted)) {
      console.error('❌ Decrypted value is not a valid Meta token');
      return null;
    }

    return decrypted;
  } catch (error: any) {
    console.error('❌ Strict decryption failed:', error.message);
    return null;
  }
}

/**
 * Mask sensitive data for logging
 */
export function maskToken(token: string): string {
  if (!token) return '[EMPTY]';
  if (token.length <= 20) return '[TOO_SHORT]';
  return `${token.substring(0, 10)}...${token.substring(token.length - 4)}`;
}

/**
 * Mask phone number for logging
 */
export function maskPhone(phone: string): string {
  if (!phone) return '[EMPTY]';
  if (phone.length <= 6) return '[INVALID]';
  return `${phone.substring(0, 3)}****${phone.substring(phone.length - 2)}`;
}

/**
 * Generate a random webhook secret
 */
export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Verify webhook signature from Meta
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  if (!payload || !signature || !secret) return false;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(`sha256=${expectedSignature}`)
  );
}



// Default export for backward compatibility
export default {
  validateEncryptionKey,
  isEncrypted,
  encrypt,
  decrypt,
  encryptIfNeeded,
  safeDecrypt,
  isMetaToken,
  isPageToken,
  safeDecryptStrict,
  maskToken,
  maskPhone,
  generateWebhookSecret,
  verifyWebhookSignature,
};