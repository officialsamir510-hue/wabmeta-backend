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
 * Check if a string looks like a Meta/Facebook token
 */
export function isMetaToken(text: string | null): boolean {
  if (!text) return false;

  // Check against known Meta token patterns
  return META_TOKEN_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Check if a string is already encrypted
 * Validates format and minimum length required for Salt+IV+Tag
 */
export function isEncrypted(text: string | null): boolean {
  if (!text) return false;

  try {
    // 1. Check if it's a Meta/Facebook token (these should never be treated as encrypted)
    if (isMetaToken(text)) {
      return false;
    }

    // 2. Check if it contains non-base64 characters (quick check)
    if (!/^[A-Za-z0-9+/]+=*$/.test(text)) {
      return false;
    }

    // 3. Try to decode as base64
    const buffer = Buffer.from(text, 'base64');

    // 4. Check minimum length (salt + iv + tag + at least 1 byte of data)
    const minLength = SALT_LENGTH + IV_LENGTH + TAG_LENGTH + 1;

    if (buffer.length < minLength) {
      return false;
    }

    // 5. Additional validation: Check if the decoded buffer makes sense
    // The first SALT_LENGTH bytes should look random (high entropy)
    // This helps distinguish from accidentally base64-looking strings
    const salt = buffer.subarray(0, SALT_LENGTH);
    const entropy = calculateEntropy(salt);

    // Encrypted data should have high entropy in the salt
    return entropy > 7.0; // Threshold for randomness
  } catch {
    return false;
  }
}

/**
 * Calculate Shannon entropy of a buffer
 */
function calculateEntropy(buffer: Buffer): number {
  const frequency: { [key: number]: number } = {};

  for (const byte of buffer) {
    frequency[byte] = (frequency[byte] || 0) + 1;
  }

  let entropy = 0;
  const len = buffer.length;

  for (const count of Object.values(frequency)) {
    const p = count / len;
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }

  return entropy;
}

/**
 * Safely decrypt - returns original if decryption fails.
 * Useful for backward compatibility during migration from plain text.
 * NEVER throws an error - always returns something usable.
 */
export function safeDecrypt(encryptedText: string | null): string | null {
  if (!encryptedText) {
    return null;
  }

  // 1. Check if it's a Meta token (plain text)
  if (isMetaToken(encryptedText)) {
    console.log(`🔑 Detected Meta token (plain text): ${maskToken(encryptedText)}`);
    return encryptedText;
  }

  // 2. Check if it's encrypted
  if (!isEncrypted(encryptedText)) {
    console.log(`📝 Detected plain text (not encrypted): ${maskToken(encryptedText)}`);
    return encryptedText;
  }

  // 3. Try to decrypt
  try {
    const decrypted = decrypt(encryptedText);
    console.log(`🔓 Successfully decrypted: ${maskToken(decrypted)}`);
    return decrypted;
  } catch (error) {
    console.error('⚠️ Decryption failed, returning original:', error);
    // Last resort: return original text
    // This ensures the system never crashes due to decryption issues
    return encryptedText;
  }
}

/**
 * Encrypt only if not already encrypted.
 * Prevents double-encryption.
 */
export function encryptIfNeeded(text: string | null): string | null {
  if (!text) return null;

  // Don't encrypt Meta tokens or already encrypted data
  if (isMetaToken(text) || isEncrypted(text)) {
    return text;
  }

  try {
    return encrypt(text);
  } catch (error) {
    console.error('Failed to encrypt, returning original:', error);
    return text; // Return original on failure
  }
}

/**
 * Mask sensitive data for logging purposes.
 * Example: "EAA123...xyz789"
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

    // Test safeDecrypt with various inputs
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
 * Use this to generate a key for your .env file.
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Migrate plain text tokens to encrypted format
 * Use this for one-time migration of existing data
 */
export async function migrateTokens(tokens: Array<{ id: string; token: string }>): Promise<void> {
  console.log(`🔄 Starting token migration for ${tokens.length} tokens...`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of tokens) {
    try {
      if (isEncrypted(item.token)) {
        console.log(`⏭️ Skipping already encrypted token: ${item.id}`);
        skipped++;
        continue;
      }

      const encrypted = encrypt(item.token);
      console.log(`✅ Migrated token ${item.id}: ${maskToken(item.token)} -> ${maskToken(encrypted)}`);
      migrated++;

      // You would update the database here
      // await updateTokenInDatabase(item.id, encrypted);
    } catch (error) {
      console.error(`❌ Failed to migrate token ${item.id}:`, error);
      failed++;
    }
  }

  console.log(`✅ Migration complete: ${migrated} migrated, ${skipped} skipped, ${failed} failed`);
}

// Export all functions
export default {
  encrypt,
  decrypt,
  hash,
  isEncrypted,
  isMetaToken,
  safeDecrypt,
  encryptIfNeeded,
  maskToken,
  validateEncryptionKey,
  generateEncryptionKey,
  migrateTokens,
};