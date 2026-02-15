"use strict";
// src/utils/tokenHelper.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareTokenForStorage = prepareTokenForStorage;
exports.getDecryptedToken = getDecryptedToken;
exports.validateAndPrepareToken = validateAndPrepareToken;
const encryption_1 = require("./encryption");
/**
 * Prepare token for storage (encrypt if needed)
 */
function prepareTokenForStorage(token) {
    if (!token) {
        throw new Error('Token is required');
    }
    // Check if it's a valid Meta token
    if (!(0, encryption_1.isMetaToken)(token)) {
        throw new Error('Invalid Meta token format');
    }
    // Encrypt if not already encrypted
    return (0, encryption_1.encryptIfNeeded)(token);
}
/**
 * Get decrypted token from account
 */
function getDecryptedToken(account) {
    if (!account.accessToken) {
        return null;
    }
    try {
        // If not encrypted (legacy), return as is
        if (!(0, encryption_1.isEncrypted)(account.accessToken)) {
            // Check if it's a valid token
            if ((0, encryption_1.isMetaToken)(account.accessToken)) {
                return account.accessToken;
            }
            return null;
        }
        // Decrypt the token
        const decrypted = (0, encryption_1.decrypt)(account.accessToken);
        // Validate it's a proper Meta token
        if (!(0, encryption_1.isMetaToken)(decrypted)) {
            console.error('Decrypted token is not a valid Meta token');
            return null;
        }
        return decrypted;
    }
    catch (error) {
        console.error('Failed to decrypt token:', error.message);
        return null;
    }
}
/**
 * Validate and prepare token
 */
function validateAndPrepareToken(token) {
    try {
        if (!token) {
            return { valid: false, error: 'Token is empty' };
        }
        // If already encrypted, decrypt to validate
        let plainToken = token;
        if ((0, encryption_1.isEncrypted)(token)) {
            const decrypted = (0, encryption_1.decrypt)(token);
            if (!decrypted) {
                return { valid: false, error: 'Failed to decrypt token' };
            }
            plainToken = decrypted;
        }
        // Validate token format
        if (!(0, encryption_1.isMetaToken)(plainToken)) {
            return { valid: false, error: 'Invalid Meta token format' };
        }
        // Encrypt for storage
        const encrypted = (0, encryption_1.encryptIfNeeded)(plainToken);
        return {
            valid: true,
            encrypted,
        };
    }
    catch (error) {
        return {
            valid: false,
            error: error.message || 'Token validation failed',
        };
    }
}
exports.default = {
    prepareTokenForStorage,
    getDecryptedToken,
    validateAndPrepareToken,
};
//# sourceMappingURL=tokenHelper.js.map