
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const accounts = await prisma.whatsAppAccount.findMany({
      select: { id: true, phoneNumberId: true, phoneNumber: true, displayName: true }
    });
    console.log('---BEG_ACCOUNTS---');
    console.log(JSON.stringify(accounts, null, 2));
    console.log('---END_ACCOUNTS---');
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await prisma.$disconnect();
  }
}

check();
