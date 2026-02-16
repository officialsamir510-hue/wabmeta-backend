// 📁 prisma/migrations/fix_templates_and_add_queue.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrate() {
    console.log('🔄 Starting migration...\n');

    try {
        // ============================================
        // STEP 1: Add whatsappAccountId to templates
        // ============================================
        console.log('📝 Step 1: Updating templates with WhatsApp account references...');

        const templates = await prisma.template.findMany({
            include: {
                organization: {
                    include: {
                        whatsappAccounts: true,
                    },
                },
            },
        });

        let updatedCount = 0;

        for (const template of templates) {
            const primaryAccount =
                template.organization.whatsappAccounts.find((acc) => acc.isDefault) ||
                template.organization.whatsappAccounts[0];

            if (primaryAccount) {
                await prisma.template.update({
                    where: { id: template.id },
                    data: {
                        whatsappAccountId: primaryAccount.id,
                        wabaId: primaryAccount.wabaId,
                    } as any,
                });
                updatedCount++;
            } else {
                console.warn(`⚠️ Template ${template.id} has no WhatsApp account - deleting`);
                await prisma.template.delete({ where: { id: template.id } });
            }
        }

        console.log(`✅ Updated ${updatedCount} templates\n`);

        // ============================================
        // STEP 2: Clean up expired OAuth states
        // ============================================
        console.log('📝 Step 2: Cleaning expired OAuth states...');

        const deletedStates = await (prisma as any).oAuthState.deleteMany({
            where: {
                expiresAt: {
                    lt: new Date(),
                },
            },
        });

        console.log(`✅ Deleted ${deletedStates.count} expired OAuth states\n`);

        // ============================================
        // STEP 3: Update conversation windows
        // ============================================
        console.log('📝 Step 3: Updating conversation 24-hour windows...');

        const conversations = await prisma.conversation.findMany({
            where: {
                lastCustomerMessageAt: {
                    not: null,
                },
            },
        });

        let windowUpdates = 0;

        for (const conv of conversations) {
            if (conv.lastCustomerMessageAt) {
                const expiresAt = new Date(
                    conv.lastCustomerMessageAt.getTime() + 24 * 60 * 60 * 1000
                );
                const isOpen = expiresAt > new Date();

                await prisma.conversation.update({
                    where: { id: conv.id },
                    data: {
                        windowExpiresAt: expiresAt,
                        isWindowOpen: isOpen,
                    } as any,
                });
                windowUpdates++;
            }
        }

        console.log(`✅ Updated ${windowUpdates} conversation windows\n`);

        console.log('✅ Migration completed successfully!');
    } catch (error) {
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