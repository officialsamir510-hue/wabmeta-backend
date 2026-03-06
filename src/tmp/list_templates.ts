import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function listTemplates() {
  const orgId = 'cmmd5zbvl0015l7hip9hebzod'; // From previous logs
  const templates = await prisma.template.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true, language: true, status: true }
  });

  console.log('Templates in DB:');
  console.log(JSON.stringify(templates, null, 2));
}

listTemplates().finally(() => prisma.$disconnect());
