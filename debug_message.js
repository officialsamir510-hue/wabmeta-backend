
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
  let output = '';
  const log = (msg) => { output += msg + '\n'; console.log(msg); };

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

  log('--- Message Details ---');
  log(JSON.stringify(msg, null, 2));

  if (msg && msg.waMessageId) {
    const allLogs = await prisma.webhookLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100
    });

    log('\n--- Checking Webhook Logs ---');
    const match = allLogs.filter(l => JSON.stringify(l.payload).includes(msg.waMessageId));
    if (match.length > 0) {
        log('\n--- Found matched logs ---');
        log(JSON.stringify(match, null, 2));
    } else {
        log('\n--- No direct match found in latest 100 logs. Printing last 5 logs: ---');
        log(JSON.stringify(allLogs.slice(0, 5), null, 2));
    }
  }
  
  fs.writeFileSync('debug_output.txt', output);
}

main().catch(e => {
    fs.writeFileSync('debug_error.txt', e.stack);
    console.error(e);
}).finally(() => prisma.$disconnect());
