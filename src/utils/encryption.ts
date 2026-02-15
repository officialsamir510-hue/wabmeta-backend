// src/utils/encryption.ts

import crypto from 'crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(config.encryptionKey.padEnd(32, '0').slice(0, 32));

/**
 * Encrypt a string value
 */
export function encrypt(text: string): string {
  if (!text) throw new Error('Cannot encrypt empty text');

  const iv = crypto.randomBytes(16);
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

  const parts = encryptedText.split(':');

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format');
  }

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
 * Check if a token looks like a Meta access token
 */
export function isMetaToken(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  return value.startsWith('EAA') && value.length > 100;
}

/**
 * Safely decrypt - returns null if fails
 */
export function safeDecrypt(encryptedText: string): string | null {
  try {
    return decrypt(encryptedText);
  } catch {
    return null;
  }
}

/**
 * Decrypt and verify it's a valid Meta token
 */
export function safeDecryptStrict(encryptedText: string): string | null {
  try {
    const decrypted = decrypt(encryptedText);

    if (!isMetaToken(decrypted)) {
      console.error('❌ Decrypted value is not a valid Meta token');
      return null;
    }

    return decrypted;
  } catch (error: any) {
    console.error('❌ Decryption failed:', error.message);
    return null;
  }
}

/**
 * Mask token for logging (show first 10 chars)
 */
export function maskToken(token: string): string {
  if (!token) return '[EMPTY]';
  if (token.length <= 10) return '[TOO_SHORT]';
  return `${token.substring(0, 10)}...${token.substring(token.length - 4)}`;
}