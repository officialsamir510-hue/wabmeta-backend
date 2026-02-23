const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    await prisma.$executeRawUnsafe(`UPDATE "Organization" SET "planType" = 'FREE_DEMO' WHERE "planType" = 'FREE'`);
    await prisma.$executeRawUnsafe(`UPDATE "Organization" SET "planType" = 'MONTHLY' WHERE "planType" = 'STARTER'`);
    await prisma.$executeRawUnsafe(`UPDATE "Organization" SET "planType" = 'BIANNUAL' WHERE "planType" = 'PRO'`);
    await prisma.$executeRawUnsafe(`UPDATE "Organization" SET "planType" = 'ANNUAL' WHERE "planType" = 'ENTERPRISE'`);

    await prisma.$executeRawUnsafe(`DELETE FROM "Plan" WHERE "type" IN ('FREE', 'STARTER', 'PRO', 'ENTERPRISE')`);

    console.log("Migration done");
}

main().catch(console.error).finally(() => prisma.$disconnect());
