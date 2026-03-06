import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkFailedMessage() {
  const msgId = 'cmmf08tkz0001lrumlqouqfud';
  const msg = await prisma.message.findUnique({
    where: { id: msgId }
  });

  if (msg) {
    console.log('✅ Found message:', JSON.stringify(msg, null, 2));
  } else {
    console.log('❌ Message not found');
  }
}

checkFailedMessage().finally(() => prisma.$disconnect());
