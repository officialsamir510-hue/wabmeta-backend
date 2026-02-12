// src/utils/encryption.ts

import crypto from 'crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

/**
 * Encrypt sensitive data
 */
export function encrypt(text: string): string {
  try {
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);

    const key = crypto.pbkdf2Sync(
      config.encryptionKey,
      salt,
      ITERATIONS,
      KEY_LENGTH,
      'sha256'
    );

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    // Combine all parts: salt + iv + tag + encrypted
    const result = Buffer.concat([
      salt,
      iv,
      tag,
      Buffer.from(encrypted, 'hex'),
    ]).toString('base64');

    return result;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt sensitive data
 */
export function decrypt(encryptedText: string): string {
  try {
    const buffer = Buffer.from(encryptedText, 'base64');

    const salt = buffer.subarray(0, SALT_LENGTH);
    const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = buffer.subarray(
      SALT_LENGTH + IV_LENGTH,
      SALT_LENGTH + IV_LENGTH + TAG_LENGTH
    );
    const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

    const key = crypto.pbkdf2Sync(
      config.encryptionKey,
      salt,
      ITERATIONS,
      KEY_LENGTH,
      'sha256'
    );

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Hash sensitive data (one-way)
 */
export function hash(text: string): string {
  return crypto
    .createHash('sha256')
    .update(text + config.encryptionKey)
    .digest('hex');
}

/**
 * Check if a string is already encrypted
 * Validates format and minimum length required for Salt+IV+Tag
 */
export function isEncrypted(text: string | null): boolean {
  if (!text) return false;

  try {
    // 1. Check if it's a Meta/Facebook token (starts with EAA...)
    // These are plain text but look like base64, so we explicitly ignore them
    if (text.startsWith('EAA') || text.startsWith('EAAI')) {
      return false;
    }

    // 2. Check if it's valid base64
    const buffer = Buffer.from(text, 'base64');

    // 3. Check minimum length (salt + iv + tag + at least 1 byte of data)
    const minLength = SALT_LENGTH + IV_LENGTH + TAG_LENGTH + 1;

    return buffer.length >= minLength;
  } catch {
    return false;
  }
}

/**
 * Safely decrypt - returns original if decryption fails.
 * Useful for backward compatibility during migration from plain text.
 */
export function safeDecrypt(encryptedText: string | null): string | null {
  if (!encryptedText) return null;

  // Check if already plain text
  if (!isEncrypted(encryptedText)) {
    // Optional: Only log strict warnings if you expect everything to be encrypted
    // console.warn('Token appears to be plain text, returning as-is');
    return encryptedText;
  }

  try {
    return decrypt(encryptedText);
  } catch (error) {
    console.error('Failed to decrypt, returning original text:', error);
    // Fallback: return the original text in case it was a false positive on isEncrypted
    return encryptedText;
  }
}

/**
 * Encrypt only if not already encrypted.
 * Prevents double-encryption.
 */
export function encryptIfNeeded(text: string | null): string | null {
  if (!text) return null;

  if (isEncrypted(text)) {
    return text; // Already encrypted
  }

  return encrypt(text);
}

/**
 * Mask sensitive data for logging purposes.
 * Example: "abcde...12345"
 */
export function maskToken(token: string | null, visibleChars: number = 6): string {
  if (!token) return '***EMPTY***';

  if (token.length <= visibleChars * 2) {
    return '***HIDDEN***';
  }

  const start = token.substring(0, visibleChars);
  const end = token.substring(token.length - visibleChars);

  return `${start}...${end}`;
}

/**
 * Validate encryption key on startup to ensure system stability.
 */
export function validateEncryptionKey(): boolean {
  if (!config.encryptionKey) {
    console.error('❌ ENCRYPTION_KEY not set in environment!');
    return false;
  }

  if (config.encryptionKey.length < 32) {
    console.error('❌ ENCRYPTION_KEY must be at least 32 characters!');
    return false;
  }

  // Test encryption/decryption round trip
  try {
    const testText = 'test_encryption_' + Date.now();
    const encrypted = encrypt(testText);
    const decrypted = decrypt(encrypted);

    if (decrypted !== testText) {
      console.error('❌ Encryption validation failed! Decrypted text does not match.');
      return false;
    }

    console.log('✅ Encryption key validated successfully');
    return true;
  } catch (error) {
    console.error('❌ Encryption validation error:', error);
    return false;
  }
}

/**
 * Generate a secure random encryption key.
 * Use this to generate a key for your .env file.
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}