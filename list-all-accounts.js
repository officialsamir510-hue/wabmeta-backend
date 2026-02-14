const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listAccounts() {
  try {
    const accounts = await prisma.whatsAppAccount.findMany({
      where: { organizationId: 'cml5mjksp0003hl1jhnqufpzi' },
      orderBy: { createdAt: 'desc' },
    });
    
    console.log(`📱 Total WhatsApp Accounts: ${accounts.length}\n`);
    
    if (accounts.length === 0) {
      console.log('❌ No accounts connected!');
      console.log('   Go to https://wabmeta.com/settings/whatsapp');
      console.log('   Click "Connect WhatsApp"');
      return;
    }
    
    accounts.forEach((acc, i) => {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Account #${i + 1}:`);
      console.log(`   ID: ${acc.id}`);
      console.log(`   Phone: ${acc.phoneNumber}`);
      console.log(`   Phone Number ID: ${acc.phoneNumberId}`);
      console.log(`   WABA ID: ${acc.wabaId}`);
      console.log(`   Status: ${acc.status}`);
      console.log(`   Is Default: ${acc.isDefault ? 'YES ⭐' : 'NO'}`);
      console.log(`   Has Token: ${acc.accessToken ? 'YES ✅' : 'NO ❌'}`);
      console.log(`   Token Length: ${acc.accessToken?.length || 0}`);
      console.log(`   Created: ${acc.createdAt}`);
      console.log(`   Updated: ${acc.updatedAt}`);
    });
    
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    // Check campaigns
    const campaigns = await prisma.campaign.findMany({
      where: { organizationId: 'cml5mjksp0003hl1jhnqufpzi' },
      select: {
        id: true,
        name: true,
        status: true,
        whatsappAccountId: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    
    console.log(`📊 Recent Campaigns (${campaigns.length}):\n`);
    
    campaigns.forEach((camp, i) => {
      console.log(`Campaign #${i + 1}:`);
      console.log(`   ID: ${camp.id}`);
      console.log(`   Name: ${camp.name}`);
      console.log(`   Status: ${camp.status}`);
      console.log(`   Using Account: ${camp.whatsappAccountId}`);
      
      const account = accounts.find(a => a.id === camp.whatsappAccountId);
      if (account) {
        console.log(`   Account Phone: ${account.phoneNumber}`);
        console.log(`   Account Status: ${account.status}`);
        console.log(`   Account Has Token: ${account.accessToken ? 'YES' : 'NO'}`);
      } else {
        console.log(`   ⚠️ Account NOT FOUND! (Deleted or wrong ID)`);
      }
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

listAccounts();
