// src/scripts/encryptTokens.ts

import { PrismaClient, WhatsAppAccountStatus } from '@prisma/client';
import {
    encrypt,
    isEncrypted,
    validateEncryptionKey,
    isMetaToken,
    maskToken
} from '../utils/encryption';

const prisma = new PrismaClient();

async function encryptTokens() {
    console.log('🔐 Starting token encryption process...\n');

    // Validate encryption key
    if (!validateEncryptionKey()) {
        console.error('❌ Invalid encryption key. Please set ENCRYPTION_KEY in .env');
        process.exit(1);
    }

    try {
        // Get all WhatsApp accounts with tokens
        const accounts = await prisma.whatsAppAccount.findMany({
            where: {
                accessToken: { not: null },
            },
            select: {
                id: true,
                phoneNumber: true,
                organizationId: true,
                accessToken: true,
                status: true,
            },
        });

        console.log(`Found ${accounts.length} accounts with tokens\n`);

        let encryptedCount = 0;
        let alreadyEncryptedCount = 0;
        let invalidCount = 0;
        let errorCount = 0;

        for (const account of accounts) {
            try {
                const token = account.accessToken!;

                // Check if already encrypted
                if (isEncrypted(token)) {
                    console.log(`✅ Account ${account.id}: Already encrypted`);
                    alreadyEncryptedCount++;
                    continue;
                }

                // Check if it's a valid Meta token
                if (!isMetaToken(token)) {
                    console.log(`❌ Account ${account.id}: Invalid token format - marking as disconnected`);

                    await prisma.whatsAppAccount.update({
                        where: { id: account.id },
                        data: {
                            status: WhatsAppAccountStatus.DISCONNECTED,
                            accessToken: null,
                            tokenExpiresAt: null,
                        },
                    });

                    invalidCount++;
                    continue;
                }

                // Encrypt the token
                console.log(`🔄 Account ${account.id}: Encrypting token...`);
                console.log(`   Original: ${maskToken(token)}`);

                const encryptedToken = encrypt(token);
                console.log(`   Encrypted: ${encryptedToken.substring(0, 50)}...`);

                // Update in database
                await prisma.whatsAppAccount.update({
                    where: { id: account.id },
                    data: {
                        accessToken: encryptedToken,
                    },
                });

                console.log(`✅ Account ${account.id}: Token encrypted successfully\n`);
                encryptedCount++;

            } catch (error: any) {
                console.error(`❌ Account ${account.id}: Error - ${error.message}\n`);
                errorCount++;
            }
        }

        console.log('\n📊 Encryption Summary:');
        console.log(`   ✅ Encrypted: ${encryptedCount}`);
        console.log(`   ✅ Already encrypted: ${alreadyEncryptedCount}`);
        console.log(`   ❌ Invalid tokens: ${invalidCount}`);
        console.log(`   ❌ Errors: ${errorCount}`);
        console.log(`   📊 Total: ${accounts.length}`);

    } catch (error: any) {
        console.error('Fatal error:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Run if called directly
if (require.main === module) {
    encryptTokens()
        .then(() => {
            console.log('\n✅ Token encryption completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Token encryption failed:', error);
            process.exit(1);
        });
}

export default encryptTokens;