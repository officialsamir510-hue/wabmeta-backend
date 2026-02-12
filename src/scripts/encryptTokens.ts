// src/scripts/encryptTokens.ts

import { PrismaClient } from '@prisma/client';
import { encrypt, isEncrypted, validateEncryptionKey } from '../utils/encryption';

const prisma = new PrismaClient();

async function migrateTokens() {
    console.log('🔐 Starting token encryption migration...\n');

    // Validate encryption key first
    if (!validateEncryptionKey()) {
        console.error('❌ Invalid encryption key! Aborting migration.');
        process.exit(1);
    }

    try {
        // Migrate WhatsApp Accounts
        console.log('📱 Migrating WhatsApp Account tokens...');
        const accounts = await prisma.whatsAppAccount.findMany({
            where: { accessToken: { not: null } }
        });

        let migratedAccounts = 0;
        for (const account of accounts) {
            const updates: any = {};

            if (account.accessToken && !isEncrypted(account.accessToken)) {
                updates.accessToken = encrypt(account.accessToken);
                console.log(`  Encrypting token for account: ${account.phoneNumber}`);
            }

            if (account.webhookSecret && !isEncrypted(account.webhookSecret)) {
                updates.webhookSecret = encrypt(account.webhookSecret);
            }

            if (Object.keys(updates).length > 0) {
                await prisma.whatsAppAccount.update({
                    where: { id: account.id },
                    data: updates
                });
                migratedAccounts++;
            }
        }

        console.log(`✅ Migrated ${migratedAccounts}/${accounts.length} WhatsApp accounts\n`);

        // Migrate Meta Connections
        console.log('🔗 Migrating Meta Connection tokens...');
        const connections = await prisma.metaConnection.findMany();

        let migratedConnections = 0;
        for (const conn of connections) {
            if (conn.accessToken && !isEncrypted(conn.accessToken)) {
                await prisma.metaConnection.update({
                    where: { id: conn.id },
                    data: { accessToken: encrypt(conn.accessToken) }
                });
                console.log(`  Encrypted token for WABA: ${conn.wabaId}`);
                migratedConnections++;
            }
        }

        console.log(`✅ Migrated ${migratedConnections}/${connections.length} Meta connections\n`);

        // Migrate API Keys
        console.log('🔑 Migrating API Key secrets...');
        const apiKeys = await prisma.apiKey.findMany();

        let migratedApiKeys = 0;
        for (const key of apiKeys) {
            if (key.secret && !isEncrypted(key.secret)) {
                await prisma.apiKey.update({
                    where: { id: key.id },
                    data: { secret: encrypt(key.secret) }
                });
                migratedApiKeys++;
            }
        }

        console.log(`✅ Migrated ${migratedApiKeys}/${apiKeys.length} API keys\n`);

        console.log('🎉 Token encryption migration completed successfully!');

        // Verification
        console.log('\n📊 Verification:');
        const unencryptedAccounts = await prisma.whatsAppAccount.findMany({
            where: { accessToken: { not: null } }
        });

        let unencryptedCount = 0;
        for (const acc of unencryptedAccounts) {
            if (acc.accessToken && !isEncrypted(acc.accessToken)) {
                unencryptedCount++;
                console.warn(`⚠️ Unencrypted token found: ${acc.phoneNumber}`);
            }
        }

        if (unencryptedCount === 0) {
            console.log('✅ All tokens are encrypted!');
        } else {
            console.warn(`⚠️ ${unencryptedCount} tokens remain unencrypted`);
        }

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Check for dry-run mode
const isDryRun = process.argv.includes('--dry-run');

if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');

    prisma.whatsAppAccount.findMany({
        where: { accessToken: { not: null } }
    }).then(accounts => {
        let needsMigration = 0;
        accounts.forEach(acc => {
            if (acc.accessToken && !isEncrypted(acc.accessToken)) {
                console.log(`Would encrypt: ${acc.phoneNumber}`);
                needsMigration++;
            }
        });
        console.log(`\n📊 ${needsMigration} accounts need encryption`);
        process.exit(0);
    });
} else {
    // Run migration
    migrateTokens();
}