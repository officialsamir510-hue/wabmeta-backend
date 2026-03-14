
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const accounts = await prisma.whatsAppAccount.findMany({
    select: { id: true, phoneNumberId: true, phoneNumber: true, displayName: true }
  });
  console.log('WhatsApp Accounts in DB:');
  console.table(accounts);
  await prisma.$disconnect();
}

check();
