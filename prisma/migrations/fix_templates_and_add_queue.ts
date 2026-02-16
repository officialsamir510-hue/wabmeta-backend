import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DIRECT_URL,
        },
    },
});

async function migrate() {
    console.log('🔄 ========== MIGRATION START ==========\n');

    try {
        // ============================================
        // STEP 1: Fix Templates (Add WhatsApp Account Reference)
        // ============================================
        console.log('📝 Step 1: Fixing templates...');

        const templates = await prisma.template.findMany({
            include: {
                organization: {
                    include: {
                        whatsappAccounts: true,
                    },
                },
            },
        });

        console.log(`   Found ${templates.length} templates to update`);

        let updatedCount = 0;
        let deletedCount = 0;

        for (const template of templates) {
            // Check if template already has whatsappAccountId
            if ((template as any).whatsappAccountId) {
                console.log(`   ✅ Template ${template.id} already has whatsappAccountId`);
                continue;
            }

            const primaryAccount =
                template.organization.whatsappAccounts.find((acc: any) => acc.isDefault) ||
                template.organization.whatsappAccounts[0];

            if (primaryAccount) {
                try {
                    await prisma.template.update({
                        where: { id: template.id },
                        data: {
                            whatsappAccountId: primaryAccount.id,
                            wabaId: primaryAccount.wabaId,
                        },
                    });
                    updatedCount++;
                    console.log(`   ✅ Updated template: ${template.name}`);
                } catch (error: any) {
                    console.error(`   ❌ Error updating template ${template.id}:`, error.message);
                }
            } else {
                // No WhatsApp account found, delete orphan template
                console.warn(`   ⚠️ Template ${template.id} has no WhatsApp account - deleting`);
                try {
                    await prisma.template.delete({ where: { id: template.id } });
                    deletedCount++;
                } catch (error: any) {
                    console.error(`   ❌ Error deleting template ${template.id}:`, error.message);
                }
            }
        }

        console.log(`✅ Step 1 Complete: ${updatedCount} updated, ${deletedCount} deleted\n`);

        // ============================================
        // STEP 2: Clean Expired OAuth States
        // ============================================
        console.log('📝 Step 2: Cleaning expired OAuth states...');

        const deletedStates = await (prisma as any).oAuthState.deleteMany({
            where: {
                expiresAt: {
                    lt: new Date(),
                },
            },
        });

        console.log(`✅ Step 2 Complete: ${deletedStates.count} expired states deleted\n`);

        // ============================================
        // STEP 3: Update Conversation Windows
        // ============================================
        console.log('📝 Step 3: Updating conversation windows...');

        const conversations = await prisma.conversation.findMany({
            where: {
                lastCustomerMessageAt: {
                    not: null,
                },
            },
        });

        console.log(`   Found ${conversations.length} conversations to update`);

        let windowUpdates = 0;

        for (const conv of conversations) {
            if (conv.lastCustomerMessageAt) {
                const expiresAt = new Date(
                    conv.lastCustomerMessageAt.getTime() + 24 * 60 * 60 * 1000
                );
                const isOpen = expiresAt > new Date();

                try {
                    await prisma.conversation.update({
                        where: { id: conv.id },
                        data: {
                            windowExpiresAt: expiresAt,
                            isWindowOpen: isOpen,
                        },
                    });
                    windowUpdates++;
                } catch (error: any) {
                    console.error(`   ❌ Error updating conversation ${conv.id}:`, error.message);
                }
            }
        }

        console.log(`✅ Step 3 Complete: ${windowUpdates} conversation windows updated\n`);

        // ============================================
        // STEP 4: Initialize Daily Message Limits
        // ============================================
        console.log('📝 Step 4: Initializing daily message limits...');

        const accounts = await prisma.whatsAppAccount.findMany({
            where: {
                dailyMessageLimit: 0, // Not set
            } as any,
        });

        console.log(`   Found ${accounts.length} accounts to update`);

        let accountUpdates = 0;

        for (const account of accounts) {
            try {
                await prisma.whatsAppAccount.update({
                    where: { id: account.id },
                    data: {
                        dailyMessageLimit: 1000, // Default limit
                        dailyMessagesUsed: 0,
                        lastLimitReset: new Date(),
                    } as any,
                });
                accountUpdates++;
            } catch (error: any) {
                console.error(`   ❌ Error updating account ${account.id}:`, error.message);
            }
        }

        console.log(`✅ Step 4 Complete: ${accountUpdates} accounts updated\n`);

        // ============================================
        // SUMMARY
        // ============================================
        console.log('📊 ========== MIGRATION SUMMARY ==========');
        console.log(`   Templates updated: ${updatedCount}`);
        console.log(`   Templates deleted: ${deletedCount}`);
        console.log(`   OAuth states cleaned: ${deletedStates.count}`);
        console.log(`   Conversation windows updated: ${windowUpdates}`);
        console.log(`   Accounts initialized: ${accountUpdates}`);
        console.log('✅ ========== MIGRATION COMPLETE ==========\n');
    } catch (error: any) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
}

migrate()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });