
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const messageId = 'cmmnr5txi00101p53x5unc9wz';
  const msg = await prisma.message.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      waMessageId: true,
      status: true,
      failureReason: true,
      content: true,
      type: true,
      conversation: {
        select: {
          lastCustomerMessageAt: true
        }
      }
    }
  });

  console.log('--- Message Details ---');
  console.log(JSON.stringify(msg, null, 2));

  if (msg?.waMessageId) {
    const logs = await prisma.webhookLog.findMany({
      where: {
        payload: {
          path: ['entry', '0', 'changes', '0', 'value', 'statuses', '0', 'id'],
          equals: msg.waMessageId
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    
    // Fallback search if JSON path search doesn't work well
    const allLogs = await prisma.webhookLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20
    });

    console.log('\n--- Related Webhook Logs ---');
    console.log(JSON.stringify(logs, null, 2));
    
    // Find logs that might mention the ID in the payload string
    const match = allLogs.filter(l => JSON.stringify(l.payload).includes(msg.waMessageId!));
    if (match.length > 0) {
        console.log('\n--- Found matched logs ---');
        console.log(JSON.stringify(match, null, 2));
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
