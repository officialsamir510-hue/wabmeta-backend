const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    await prisma.$executeRawUnsafe(`UPDATE "Organization" SET "planType" = 'FREE_DEMO' WHERE "planType" = 'FREE'`);
    await prisma.$executeRawUnsafe(`UPDATE "Organization" SET "planType" = 'MONTHLY' WHERE "planType" = 'STARTER'`);
    await prisma.$executeRawUnsafe(`UPDATE "Organization" SET "planType" = 'BIANNUAL' WHERE "planType" = 'PRO'`);
    await prisma.$executeRawUnsafe(`UPDATE "Organization" SET "planType" = 'ANNUAL' WHERE "planType" = 'ENTERPRISE'`);

    // Find new plans mapping to olds
    const freePlan = await prisma.$queryRawUnsafe(`SELECT id FROM "Plan" WHERE type = 'FREE_DEMO' LIMIT 1`);
    const starterPlan = (await prisma.$queryRawUnsafe(`SELECT id FROM "Plan" WHERE type = 'MONTHLY' LIMIT 1`));
    const proPlan = (await prisma.$queryRawUnsafe(`SELECT id FROM "Plan" WHERE type = 'BIANNUAL' LIMIT 1`));
    const enterprisePlan = (await prisma.$queryRawUnsafe(`SELECT id FROM "Plan" WHERE type = 'ANNUAL' LIMIT 1`));

    // Update subscriptions
    if (freePlan.length) await prisma.$executeRawUnsafe(`UPDATE "Subscription" SET "planId" = '${freePlan[0].id}' WHERE "planId" IN (SELECT id FROM "Plan" WHERE "type" = 'FREE')`);
    if (starterPlan.length) await prisma.$executeRawUnsafe(`UPDATE "Subscription" SET "planId" = '${starterPlan[0].id}' WHERE "planId" IN (SELECT id FROM "Plan" WHERE "type" = 'STARTER')`);
    if (proPlan.length) await prisma.$executeRawUnsafe(`UPDATE "Subscription" SET "planId" = '${proPlan[0].id}' WHERE "planId" IN (SELECT id FROM "Plan" WHERE "type" = 'PRO')`);
    if (enterprisePlan.length) await prisma.$executeRawUnsafe(`UPDATE "Subscription" SET "planId" = '${enterprisePlan[0].id}' WHERE "planId" IN (SELECT id FROM "Plan" WHERE "type" = 'ENTERPRISE')`);

    await prisma.$executeRawUnsafe(`DELETE FROM "Plan" WHERE "type" IN ('FREE', 'STARTER', 'PRO', 'ENTERPRISE')`);

    console.log("Migration done");
}

main().catch(console.error).finally(() => prisma.$disconnect());
