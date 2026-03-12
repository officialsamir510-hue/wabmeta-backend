
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const stats = await prisma.campaign.aggregate({
    _count: { id: true },
    _sum: {
      sentCount: true,
      deliveredCount: true,
      readCount: true,
      failedCount: true,
    },
  });
  console.log('Stats:', stats);

  const campaigns = await prisma.campaign.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      status: true,
      sentCount: true,
      deliveredCount: true,
    }
  });
  console.log('Recent 5 campaigns:', campaigns);
}

main().catch(console.error).finally(() => prisma.$disconnect());
