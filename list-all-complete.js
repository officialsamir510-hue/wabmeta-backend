const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listAllAccountsComplete() {
  try {
    const accounts = await prisma.whatsAppAccount.findMany({
      orderBy: { createdAt: 'desc' },
    });
    
    console.log(`📱 TOTAL WhatsApp Accounts in Database: ${accounts.length}\n`);
    console.log('═══════════════════════════════════════════════════════════\n');
    
    accounts.forEach((acc, i) => {
      console.log(`Account #${i + 1}:`);
      console.log(`   ID: ${acc.id}`);
      console.log(`   Organization ID: ${acc.organizationId}`);
      console.log(`   Phone: ${acc.phoneNumber}`);
      console.log(`   Phone Number ID: ${acc.phoneNumberId}`);
      console.log(`   WABA ID: ${acc.wabaId}`);
      console.log(`   Status: ${acc.status}`);
      console.log(`   Has Token: ${acc.accessToken ? 'YES' : 'NO'}`);
      console.log(`   Token Length: ${acc.accessToken?.length || 0}`);
      console.log(`   Is Default: ${acc.isDefault}`);
      console.log(`   Created: ${acc.createdAt}`);
      
      if (acc.id === 'cmlaq05ow0001uv1jpmsugrfs') {
        console.log(`   ⭐⭐⭐ THIS IS THE CAMPAIGN ACCOUNT ⭐⭐⭐`);
      }
      
      console.log('');
    });
    
    console.log('═══════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

listAllAccountsComplete();
