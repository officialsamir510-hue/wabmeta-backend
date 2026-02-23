const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    await prisma.$executeRawUnsafe(`UPDATE "Organization" SET "planType" = 'FREE_DEMO' WHERE "planType" = 'FREE'`);
    await prisma.$executeRawUnsafe(`UPDATE "Organization" SET "planType" = 'MONTHLY' WHERE "planType" = 'STARTER'`);
    await prisma.$executeRawUnsafe(`UPDATE "Organization" SET "planType" = 'BIANNUAL' WHERE "planType" = 'PRO'`);
    await prisma.$executeRawUnsafe(`UPDATE "Organization" SET "planType" = 'ANNUAL' WHERE "planType" = 'ENTERPRISE'`);

    await prisma.$executeRawUnsafe(`UPDATE "Plan" SET "type" = 'FREE_DEMO' WHERE "type" = 'FREE'`);
    await prisma.$executeRawUnsafe(`UPDATE "Plan" SET "type" = 'MONTHLY' WHERE "type" = 'STARTER'`);
    await prisma.$executeRawUnsafe(`UPDATE "Plan" SET "type" = 'BIANNUAL' WHERE "type" = 'PRO'`);
    await prisma.$executeRawUnsafe(`UPDATE "Plan" SET "type" = 'ANNUAL' WHERE "type" = 'ENTERPRISE'`);

    console.log("Migration done");
}

main().catch(console.error).finally(() => prisma.$disconnect());
