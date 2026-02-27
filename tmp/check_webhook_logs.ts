import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function main() {
    const logs = await prisma.webhookLog.findMany({
        where: {
            status: 'FAILED',
        },
        orderBy: {
            processedAt: 'desc',
        },
        take: 1,
    });

    if (logs.length > 0) {
        fs.writeFileSync('tmp/failed_payload.json', JSON.stringify(logs[0].payload, null, 2));
        console.log('Saved payload to tmp/failed_payload.json');
        console.log('Error Message:', logs[0].errorMessage);
    } else {
        console.log('No failed logs found.');
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
