import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkTemplateAccounts() {
  const orgId = 'cmmd5zbvl0015l7hip9hebzod';
  const templates = await prisma.template.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true, language: true, whatsappAccountId: true, wabaId: true }
  });

  console.log(JSON.stringify(templates, null, 2));
}

checkTemplateAccounts().finally(() => prisma.$disconnect());
