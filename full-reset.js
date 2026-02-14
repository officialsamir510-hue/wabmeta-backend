const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fullReset() {
  console.log('🧹 FULL RESET - Cleaning ALL WhatsApp Data\n');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  try {
    const orgId = 'cml5mjksp0003hl1jhnqufpzi';
    
    // 1. Count current data
    const accountCount = await prisma.whatsAppAccount.count({
      where: { organizationId: orgId },
    });
    
    const campaignCount = await prisma.campaign.count({
      where: { organizationId: orgId },
    });
    
    console.log('📊 Current State:');
    console.log(`   WhatsApp Accounts: ${accountCount}`);
    console.log(`   Campaigns: ${campaignCount}\n`);
    
    // 2. Delete all WhatsApp accounts
    console.log('🗑️  Deleting WhatsApp accounts...');
    const accountsDeleted = await prisma.whatsAppAccount.deleteMany({
      where: { organizationId: orgId },
    });
    console.log(`   ✅ Deleted ${accountsDeleted.count} account(s)\n`);
    
    // 3. Reset campaigns to DRAFT (optional - delete if you want)
    console.log('🔄 Resetting campaigns...');
    const campaignsReset = await prisma.campaign.updateMany({
      where: { 
        organizationId: orgId,
        status: { in: ['RUNNING', 'PAUSED', 'SCHEDULED', 'FAILED'] },
      },
      data: { status: 'DRAFT' },
    });
    console.log(`   ✅ Reset ${campaignsReset.count} campaign(s)\n`);
    
    // 4. Optional: Delete all campaigns
    // Uncomment if you want fresh start
    /*
    console.log('🗑️  Deleting campaigns...');
    const campaignsDeleted = await prisma.campaign.deleteMany({
      where: { organizationId: orgId },
    });
    console.log(`   ✅ Deleted ${campaignsDeleted.count} campaign(s)\n`);
    */
    
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('✅ RESET COMPLETE!\n');
    console.log('📱 NEXT STEPS FOR MULTI-USER PLATFORM:\n');
    console.log('1. Each user goes to: https://wabmeta.com/settings/whatsapp');
    console.log('2. Clicks "Connect WhatsApp"');
    console.log('3. Logs in with THEIR Facebook account');
    console.log('4. Selects THEIR WhatsApp Business Account');
    console.log('5. Completes OAuth flow');
    console.log('6. Creates campaigns with THEIR connected account\n');
    console.log('🎯 Each user will have:');
    console.log('   - Own WhatsApp account connected');
    console.log('   - Own campaigns');
    console.log('   - Own templates');
    console.log('   - Isolated data\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fullReset();
