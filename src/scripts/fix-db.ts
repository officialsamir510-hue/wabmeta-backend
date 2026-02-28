import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function run() {
    console.log('Using database URL for manual SQL...');

    try {
        // 1. Add isActive to WhatsAppAccount
        console.log('Adding WhatsAppAccount.isActive...');
        await prisma.$executeRawUnsafe(`ALTER TABLE "WhatsAppAccount" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT true`);

        // 2. Update Message model fields
        console.log('Updating Message fields...');
        await prisma.$executeRawUnsafe(`ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "mediaId" TEXT`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "fileName" TEXT`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "whatsappMessageId" TEXT`);

        // 3. Add unique index for whatsappMessageId
        console.log('Adding unique index...');
        try {
            await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Message_whatsappMessageId_key" ON "Message"("whatsappMessageId")`);
        } catch (e) {
            console.log('Index note:', e.message);
        }

        console.log('✅ DATABASE SCHEMA UPDATED SUCCESSFULLY');
    } catch (err) {
        console.error('❌ DATABASE UPDATE FAILED:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

run();
