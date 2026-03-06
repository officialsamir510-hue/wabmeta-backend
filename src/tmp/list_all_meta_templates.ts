import { whatsappApi } from '../modules/whatsapp/whatsapp.api';
import { metaService } from '../modules/meta/meta.service';

async function listAllTemplates() {
  const waAccountId = 'cmmd63y59001ll7hiyqtmbyf1';
  const data = await metaService.getAccountWithToken(waAccountId);
  if (!data) return;
  
  const { accessToken } = data;
  const wabaId = data.account.wabaId;
  
  console.log('--- Listing ALL Templates from Meta ---');
  const templates = await whatsappApi.listMessageTemplates(wabaId, accessToken);
  console.log(JSON.stringify(templates.map(t => ({ name: t.name, language: t.language, status: t.status })), null, 2));
}

listAllTemplates().catch(console.error);
