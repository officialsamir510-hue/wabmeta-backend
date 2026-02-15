// src/utils/tokenHelper.ts

import { WhatsAppAccount } from '@prisma/client';
import { encrypt, decrypt, encryptIfNeeded, isEncrypted, isMetaToken, maskToken } from './encryption';

/**
 * Prepare token for storage (encrypt if needed)
 */
export function prepareTokenForStorage(token: string): string {
    if (!token) {
        throw new Error('Token is required');
    }

    // Check if it's a valid Meta token
    if (!isMetaToken(token)) {
        throw new Error('Invalid Meta token format');
    }

    // Encrypt if not already encrypted
    return encryptIfNeeded(token);
}

/**
 * Get decrypted token from account
 */
export function getDecryptedToken(account: WhatsAppAccount): string | null {
    if (!account.accessToken) {
        return null;
    }

    try {
        // If not encrypted (legacy), return as is
        if (!isEncrypted(account.accessToken)) {
            // Check if it's a valid token
            if (isMetaToken(account.accessToken)) {
                return account.accessToken;
            }
            return null;
        }

        // Decrypt the token
        const decrypted = decrypt(account.accessToken);

        // Validate it's a proper Meta token
        if (!isMetaToken(decrypted)) {
            console.error('Decrypted token is not a valid Meta token');
            return null;
        }

        return decrypted;
    } catch (error: any) {
        console.error('Failed to decrypt token:', error.message);
        return null;
    }
}

/**
 * Validate and prepare token
 */
export function validateAndPrepareToken(token: string): {
    valid: boolean;
    encrypted?: string;
    error?: string;
} {
    try {
        if (!token) {
            return { valid: false, error: 'Token is empty' };
        }

        // If already encrypted, decrypt to validate
        let plainToken = token;
        if (isEncrypted(token)) {
            const decrypted = decrypt(token);
            if (!decrypted) {
                return { valid: false, error: 'Failed to decrypt token' };
            }
            plainToken = decrypted;
        }

        // Validate token format
        if (!isMetaToken(plainToken)) {
            return { valid: false, error: 'Invalid Meta token format' };
        }

        // Encrypt for storage
        const encrypted = encryptIfNeeded(plainToken);

        return {
            valid: true,
            encrypted,
        };
    } catch (error: any) {
        return {
            valid: false,
            error: error.message || 'Token validation failed',
        };
    }
}

export default {
    prepareTokenForStorage,
    getDecryptedToken,
    validateAndPrepareToken,
};