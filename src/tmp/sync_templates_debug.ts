import { PrismaClient } from '@prisma/client';
import { templatesService } from '../modules/templates/templates.service';
const prisma = new PrismaClient();

async function syncAndLog() {
  const orgId = 'cmmd5zbvl0015l7hip9hebzod';
  const waAccountId = 'cmmd63y59001ll7hiyqtmbyf1';
  
  console.log('--- Syncing Templates ---');
  const result = await templatesService.syncFromMeta(orgId, waAccountId);
  console.log('Sync result:', result);

  const templates = await prisma.template.findMany({
    where: { organizationId: orgId },
    select: { name: true, language: true, metaTemplateId: true }
  });
  console.log('Final templates in DB:');
  console.log(JSON.stringify(templates, null, 2));
}

syncAndLog().finally(() => prisma.$disconnect());
