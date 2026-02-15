import { WhatsAppAccount } from '@prisma/client';
/**
 * Prepare token for storage (encrypt if needed)
 */
export declare function prepareTokenForStorage(token: string): string;
/**
 * Get decrypted token from account
 */
export declare function getDecryptedToken(account: WhatsAppAccount): string | null;
/**
 * Validate and prepare token
 */
export declare function validateAndPrepareToken(token: string): {
    valid: boolean;
    encrypted?: string;
    error?: string;
};
declare const _default: {
    prepareTokenForStorage: typeof prepareTokenForStorage;
    getDecryptedToken: typeof getDecryptedToken;
    validateAndPrepareToken: typeof validateAndPrepareToken;
};
export default _default;
//# sourceMappingURL=tokenHelper.d.ts.map