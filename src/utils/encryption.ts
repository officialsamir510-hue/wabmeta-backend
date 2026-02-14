// src/utils/encryption.ts

import crypto from 'crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

// Meta/Facebook token patterns
const META_TOKEN_PATTERNS = [
  /^EAA[A-Za-z0-9]+/,  // Standard Meta tokens
  /^EAAI[A-Za-z0-9]+/, // Instagram tokens
  /^EAAG[A-Za-z0-9]+/, // Other Meta tokens
];

/**
 * Check if a string looks like a Meta/Facebook token
 */
export function isMetaToken(text: string | null): boolean {
  if (!text) return false;
  return META_TOKEN_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Check if a string is already encrypted.
 *
 * ✅ FIXED: Removed entropy-based detection (causing false negatives).
 * Now uses:
 * - base64 format check
 * - decoded buffer minimum length check (salt+iv+tag+1)
 */
export function isEncrypted(text: string | null): boolean {
  if (!text) return false;

  // Meta tokens are plaintext, never "encrypted"
  if (isMetaToken(text)) return false;

  // Base64-ish quick check
  if (!/^[A-Za-z0-9+/]+=*$/.test(text)) return false;

  try {
    const buffer = Buffer.from(text, 'base64');

    // Minimum length (salt + iv + tag + at least 1 byte of ciphertext)
    const minLength = SALT_LENGTH + IV_LENGTH + TAG_LENGTH + 1;
    return buffer.length >= minLength;
  } catch {
    return false;
  }
}

/**
 * Encrypt sensitive data
 */
export function encrypt(text: string): string {
  try {
    // Don't encrypt if already encrypted
    if (isEncrypted(text)) {
      console.warn('⚠️ Attempted to encrypt already encrypted data');
      return text;
    }

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

    // salt + iv + tag + ciphertext
    return Buffer.concat([salt, iv, tag, Buffer.from(encrypted, 'hex')]).toString('base64');
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
  return crypto.createHash('sha256').update(text + config.encryptionKey).digest('hex');
}

/**
 * Mask sensitive data for logging purposes.
 */
export function maskToken(token: string | null, visibleChars: number = 6): string {
  if (!token) return '***EMPTY***';
  if (token.length <= visibleChars * 2) return '***HIDDEN***';
  const start = token.substring(0, visibleChars);
  const end = token.substring(token.length - visibleChars);
  return `${start}...${end}`;
}

/**
 * Safely decrypt - returns original if decryption fails.
 * Useful for backward compatibility.
 */
export function safeDecrypt(encryptedText: string | null): string | null {
  if (!encryptedText) return null;

  // Meta token plaintext
  if (isMetaToken(encryptedText)) {
    console.log(`🔑 Detected Meta token (plain text): ${maskToken(encryptedText)}`);
    return encryptedText;
  }

  // Not encrypted => treat as plaintext
  if (!isEncrypted(encryptedText)) {
    console.log(`📝 Detected plain text (not encrypted): ${maskToken(encryptedText)}`);
    return encryptedText;
  }

  // Encrypted => try decrypt
  try {
    const decrypted = decrypt(encryptedText);
    console.log(`🔓 Successfully decrypted: ${maskToken(decrypted)}`);
    return decrypted;
  } catch (error) {
    console.error('⚠️ Decryption failed, returning original:', error);
    return encryptedText;
  }
}

/**
 * ✅ NEW: Strict decrypt for tokens (recommended)
 * - returns Meta token plaintext if already plaintext
 * - returns decrypted value if encrypted and decrypt succeeds
 * - otherwise returns null (never returns encrypted garbage)
 */
export function safeDecryptStrict(encryptedText: string | null | undefined): string | null {
  if (!encryptedText) return null;

  if (isMetaToken(encryptedText)) return encryptedText;

  if (!isEncrypted(encryptedText)) return null;

  try {
    const decrypted = decrypt(encryptedText);
    return decrypted;
  } catch {
    return null;
  }
}

/**
 * Encrypt only if not already encrypted.
 */
export function encryptIfNeeded(text: string | null): string | null {
  if (!text) return null;

  // Don't encrypt Meta tokens or already encrypted data
  if (isMetaToken(text) || isEncrypted(text)) return text;

  try {
    return encrypt(text);
  } catch (error) {
    console.error('Failed to encrypt, returning original:', error);
    return text;
  }
}

/**
 * Validate encryption key on startup.
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

  try {
    const testText = 'test_encryption_' + Date.now();
    const encrypted = encrypt(testText);
    const decrypted = decrypt(encrypted);

    if (decrypted !== testText) {
      console.error('❌ Encryption validation failed! Decrypted text does not match.');
      return false;
    }

    // Test safeDecrypt with plain Meta token
    const metaToken = 'EAATestToken123';
    const safeResult = safeDecrypt(metaToken);
    if (safeResult !== metaToken) {
      console.error('❌ SafeDecrypt failed to handle plain Meta token');
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
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

export default {
  encrypt,
  decrypt,
  hash,
  isEncrypted,
  isMetaToken,
  safeDecrypt,
  safeDecryptStrict,
  encryptIfNeeded,
  maskToken,
  validateEncryptionKey,
  generateEncryptionKey,
};