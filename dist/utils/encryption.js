"use strict";
// src/utils/encryption.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encrypt = encrypt;
exports.decrypt = decrypt;
exports.hash = hash;
const crypto_1 = __importDefault(require("crypto"));
const config_1 = require("../config");
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;
/**
 * Encrypt sensitive data
 */
function encrypt(text) {
    try {
        const salt = crypto_1.default.randomBytes(SALT_LENGTH);
        const iv = crypto_1.default.randomBytes(IV_LENGTH);
        const key = crypto_1.default.pbkdf2Sync(config_1.config.encryptionKey, salt, ITERATIONS, KEY_LENGTH, 'sha256');
        const cipher = crypto_1.default.createCipheriv(ALGORITHM, key, iv);
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
    }
    catch (error) {
        console.error('Encryption error:', error);
        throw new Error('Failed to encrypt data');
    }
}
/**
 * Decrypt sensitive data
 */
function decrypt(encryptedText) {
    try {
        const buffer = Buffer.from(encryptedText, 'base64');
        const salt = buffer.subarray(0, SALT_LENGTH);
        const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
        const tag = buffer.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
        const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
        const key = crypto_1.default.pbkdf2Sync(config_1.config.encryptionKey, salt, ITERATIONS, KEY_LENGTH, 'sha256');
        const decipher = crypto_1.default.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(tag);
        let decrypted = decipher.update(encrypted);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString('utf8');
    }
    catch (error) {
        console.error('Decryption error:', error);
        throw new Error('Failed to decrypt data');
    }
}
/**
 * Hash sensitive data (one-way)
 */
function hash(text) {
    return crypto_1.default
        .createHash('sha256')
        .update(text + config_1.config.encryptionKey)
        .digest('hex');
}
//# sourceMappingURL=encryption.js.map