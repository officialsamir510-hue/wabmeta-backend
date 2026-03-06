import { whatsappApi } from '../modules/whatsapp/whatsapp.api';
import { metaService } from '../modules/meta/meta.service';

async function checkTemplateInMeta() {
  const waAccountId = 'cmmd63y59001ll7hiyqtmbyf1';
  const data = await metaService.getAccountWithToken(waAccountId);
  if (!data) throw new Error('Account not found');
  
  const { accessToken } = data;
  const wabaId = data.account.wabaId;
  
  console.log('--- Listing Templates from Meta ---');
  const templates = await whatsappApi.listMessageTemplates(wabaId, accessToken);
  
  const marketing = templates.filter(t => t.name.startsWith('marketing'));
  console.log('Marketing Templates in Meta:');
  console.log(JSON.stringify(marketing, null, 2));
}

checkTemplateInMeta().catch(console.error);
