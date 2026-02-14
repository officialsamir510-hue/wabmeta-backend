const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanAccounts() {
  try {
    console.log('🧹 Cleaning old WhatsApp accounts...\n');
    
    // Get all accounts
    const accounts = await prisma.whatsAppAccount.findMany({
      where: { organizationId: 'cml5mjksp0003hl1jhnqufpzi' },
    });
    
    console.log(`Found ${accounts.length} account(s):\n`);
    
    accounts.forEach((acc, i) => {
      console.log(`Account ${i + 1}:`);
      console.log(`   ID: ${acc.id}`);
      console.log(`   Phone: ${acc.phoneNumber}`);
      console.log(`   Status: ${acc.status}`);
      console.log('');
    });
    
    // Delete all
    const result = await prisma.whatsAppAccount.deleteMany({
      where: { organizationId: 'cml5mjksp0003hl1jhnqufpzi' },
    });
    
    console.log(`✅ Deleted ${result.count} account(s)`);
    console.log('\n📱 Next Steps:');
    console.log('   1. Go to https://wabmeta.com/settings/whatsapp');
    console.log('   2. Click "Connect WhatsApp"');
    console.log('   3. Login with NEW business account owner');
    console.log('   4. Select NEW WhatsApp Business Account');
    console.log('   5. Complete OAuth flow');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

cleanAccounts();
