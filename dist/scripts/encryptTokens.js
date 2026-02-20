"use strict";
// src/scripts/encryptTokens.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const encryption_1 = require("../utils/encryption");
const database_1 = __importDefault(require("../config/database"));
async function encryptTokens() {
    console.log('🔐 Starting token encryption process...\n');
    // Validate encryption key
    if (!(0, encryption_1.validateEncryptionKey)()) {
        console.error('❌ Invalid encryption key. Please set ENCRYPTION_KEY in .env');
        process.exit(1);
    }
    try {
        // Get all WhatsApp accounts with tokens
        const accounts = await database_1.default.whatsAppAccount.findMany({
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
                const token = account.accessToken;
                // Check if already encrypted
                if ((0, encryption_1.isEncrypted)(token)) {
                    console.log(`✅ Account ${account.id}: Already encrypted`);
                    alreadyEncryptedCount++;
                    continue;
                }
                // Check if it's a valid Meta token
                if (!(0, encryption_1.isMetaToken)(token)) {
                    console.log(`❌ Account ${account.id}: Invalid token format - marking as disconnected`);
                    await database_1.default.whatsAppAccount.update({
                        where: { id: account.id },
                        data: {
                            status: client_1.WhatsAppAccountStatus.DISCONNECTED,
                            accessToken: null,
                            tokenExpiresAt: null,
                        },
                    });
                    invalidCount++;
                    continue;
                }
                // Encrypt the token
                console.log(`🔄 Account ${account.id}: Encrypting token...`);
                console.log(`   Original: ${(0, encryption_1.maskToken)(token)}`);
                const encryptedToken = (0, encryption_1.encrypt)(token);
                console.log(`   Encrypted: ${encryptedToken.substring(0, 50)}...`);
                // Update in database
                await database_1.default.whatsAppAccount.update({
                    where: { id: account.id },
                    data: {
                        accessToken: encryptedToken,
                    },
                });
                console.log(`✅ Account ${account.id}: Token encrypted successfully\n`);
                encryptedCount++;
            }
            catch (error) {
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
    }
    catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
    finally {
        await database_1.default.$disconnect();
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
exports.default = encryptTokens;
//# sourceMappingURL=encryptTokens.js.map