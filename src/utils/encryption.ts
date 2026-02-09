// src/utils/encryption.ts

import crypto from 'crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || config.jwtSecret || 'fallback-key-32-chars-minimum!!';

// Ensure key is exactly 32 bytes for AES-256
const getKey = (): Buffer => {
  const key = ENCRYPTION_KEY.substring(0, 32).padEnd(32, '0');
  return Buffer.from(key);
};

export class EncryptionUtil {
  /**
   * Encrypt data
   */
  static encrypt(text: string): string {
    try {
      if (!text) return '';

      // Generate random IV (16 bytes for AES)
      const iv = crypto.randomBytes(16);
      const key = getKey();

      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Return IV + encrypted data (hex format)
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data
   */
  static decrypt(encryptedText: string): string {
    try {
      if (!encryptedText) return '';

      // ✅ FIX: Handle plain text (not encrypted) gracefully
      if (!encryptedText.includes(':')) {
        console.warn('⚠️ Data not encrypted, returning as-is');
        return encryptedText;
      }

      const parts = encryptedText.split(':');
      
      // ✅ Validate format
      if (parts.length !== 2) {
        console.warn('⚠️ Invalid encrypted format, returning as-is');
        return encryptedText;
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];

      // ✅ Validate IV length
      if (iv.length !== 16) {
        console.warn('⚠️ Invalid IV length, returning as-is');
        return encryptedText;
      }

      const key = getKey();
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error: any) {
      console.error('Decryption error:', error);
      
      // ✅ Return original text if decryption fails
      console.warn('⚠️ Decryption failed, returning original text');
      return encryptedText;
    }
  }

  /**
   * Check if text is encrypted
   */
  static isEncrypted(text: string): boolean {
    if (!text) return false;
    
    // Check if has IV:data format
    const parts = text.split(':');
    if (parts.length !== 2) return false;
    
    // Check if first part is valid hex (32 chars for 16-byte IV)
    return parts[0].length === 32 && /^[0-9a-f]+$/i.test(parts[0]);
  }

  /**
   * Hash data (one-way)
   */
  static hash(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
  }
}