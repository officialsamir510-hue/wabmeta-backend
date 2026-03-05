import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function fixAllUsers() {
    console.log('🔧 ========== FIXING ALL USERS ==========\n');

    // Get all users without organizations
    const usersWithoutOrg = await prisma.user.findMany({
        where: {
            memberships: {
                none: {}
            }
        }
    });

    console.log(`Found ${usersWithoutOrg.length} users without organizations\n`);

    let fixed = 0;
    let failed = 0;

    const freePlan = await prisma.plan.findUnique({ where: { type: 'FREE_DEMO' } });

    for (const user of usersWithoutOrg) {
        try {
            const randomId = uuidv4().substring(0, 8);
            const baseSlug = user.firstName?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user';
            const orgSlug = `${baseSlug}-${randomId}`;

            // Create organization
            const org = await prisma.organization.create({
                data: {
                    name: `${user.firstName || 'User'}'s Workspace`,
                    slug: orgSlug,
                    ownerId: user.id,
                    planType: 'FREE_DEMO',
                    featureSimpleBulkUpload: false,
                    featureCsvUpload: false,
                    featureOverrideByAdmin: false
                } as any
            });

            // Create membership
            await prisma.organizationMember.create({
                data: {
                    organizationId: org.id,
                    userId: user.id,
                    role: 'OWNER',
                    joinedAt: new Date()
                }
            });

            if (freePlan) {
                await prisma.subscription.create({
                    data: {
                        organizationId: org.id,
                        planId: freePlan.id,
                        status: 'ACTIVE',
                        billingCycle: 'monthly',
                        currentPeriodStart: new Date(),
                        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    },
                });
            }

            fixed++;
            console.log(`✅ [${fixed}/${usersWithoutOrg.length}] ${user.email} -> ${org.id}`);

        } catch (error: any) {
            failed++;
            console.error(`❌ Failed: ${user.email} - ${error.message}`);
        }
    }

    console.log(`\n🎉 ========== DONE ==========`);
    console.log(`   Fixed: ${fixed}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Total: ${usersWithoutOrg.length}\n`);
}

fixAllUsers()
    .catch((error) => {
        console.error('Script error:', error);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
