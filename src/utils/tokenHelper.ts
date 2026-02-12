// src/utils/tokenHelper.ts

import { encrypt, decrypt, safeDecrypt, encryptIfNeeded, isEncrypted, maskToken } from './encryption';
import { PrismaClient, WhatsAppAccount, MetaConnection } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Safely get decrypted token from WhatsApp Account
 */
export async function getDecryptedToken(accountId: string): Promise<string | null> {
    const account = await prisma.whatsAppAccount.findUnique({
        where: { id: accountId },
        select: { accessToken: true }
    });

    if (!account?.accessToken) return null;

    return safeDecrypt(account.accessToken);
}

/**
 * Update token with encryption
 */
export async function updateEncryptedToken(
    accountId: string,
    newToken: string
): Promise<void> {
    const encryptedToken = encrypt(newToken);

    await prisma.whatsAppAccount.update({
        where: { id: accountId },
        data: {
            accessToken: encryptedToken,
            tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // 60 days
        }
    });
}

/**
 * Log token info safely
 */
export function logTokenSafely(token: string | null, context: string): void {
    if (!token) {
        console.log(`[${context}] Token: EMPTY`);
        return;
    }

    const masked = maskToken(token);
    const encrypted = isEncrypted(token);

    console.log(`[${context}] Token: ${masked} (encrypted: ${encrypted})`);
}

/**
 * Get all accounts with plain text tokens (for migration)
 */
export async function getAccountsWithPlainTokens() {
    const accounts = await prisma.whatsAppAccount.findMany({
        where: {
            accessToken: { not: null }
        },
        select: {
            id: true,
            phoneNumber: true,
            accessToken: true,
            webhookSecret: true
        }
    });

    return accounts.filter(account =>
        (account.accessToken && !isEncrypted(account.accessToken)) ||
        (account.webhookSecret && !isEncrypted(account.webhookSecret))
    );
}

/**
 * Get all Meta connections with plain text tokens
 */
export async function getMetaConnectionsWithPlainTokens() {
    const connections = await prisma.metaConnection.findMany({
        select: {
            id: true,
            wabaId: true,
            accessToken: true
        }
    });

    return connections.filter(conn =>
        conn.accessToken && !isEncrypted(conn.accessToken)
    );
}

export default {
    getDecryptedToken,
    updateEncryptedToken,
    logTokenSafely,
    getAccountsWithPlainTokens,
    getMetaConnectionsWithPlainTokens
};