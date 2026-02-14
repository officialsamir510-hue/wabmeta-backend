const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fullResetFixed() {
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
    
    const contactCount = await prisma.contact.count({
      where: { organizationId: orgId },
    });
    
    const templateCount = await prisma.template.count({
      where: { organizationId: orgId },
    });
    
    console.log('📊 Current State:');
    console.log(`   WhatsApp Accounts: ${accountCount}`);
    console.log(`   Campaigns: ${campaignCount}`);
    console.log(`   Contacts: ${contactCount}`);
    console.log(`   Templates: ${templateCount}\n`);
    
    // Ask for confirmation
    console.log('⚠️  WARNING: This will delete ALL data!\n');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('🗑️  Starting deletion...\n');
    
    // 2. Delete in correct order (child → parent)
    
    // Step 1: Delete CampaignContacts first
    console.log('1️⃣  Deleting campaign contacts...');
    const campaignContactsDeleted = await prisma.campaignContact.deleteMany({
      where: {
        Campaign: {
          organizationId: orgId,
        },
      },
    });
    console.log(`   ✅ Deleted ${campaignContactsDeleted.count} campaign contact(s)\n`);
    
    // Step 2: Delete Campaigns
    console.log('2️⃣  Deleting campaigns...');
    const campaignsDeleted = await prisma.campaign.deleteMany({
      where: { organizationId: orgId },
    });
    console.log(`   ✅ Deleted ${campaignsDeleted.count} campaign(s)\n`);
    
    // Step 3: Delete Templates
    console.log('3️⃣  Deleting templates...');
    const templatesDeleted = await prisma.template.deleteMany({
      where: { organizationId: orgId },
    });
    console.log(`   ✅ Deleted ${templatesDeleted.count} template(s)\n`);
    
    // Step 4: Delete Conversations and Messages
    console.log('4️⃣  Deleting conversations and messages...');
    const conversationsDeleted = await prisma.conversation.deleteMany({
      where: { organizationId: orgId },
    });
    console.log(`   ✅ Deleted ${conversationsDeleted.count} conversation(s)\n`);
    
    // Step 5: Delete Contact Group Members
    console.log('5️⃣  Deleting contact group members...');
    const groupMembersDeleted = await prisma.contactGroupMember.deleteMany({
      where: {
        group: {
          organizationId: orgId,
        },
      },
    });
    console.log(`   ✅ Deleted ${groupMembersDeleted.count} group member(s)\n`);
    
    // Step 6: Delete Contact Groups
    console.log('6️⃣  Deleting contact groups...');
    const groupsDeleted = await prisma.contactGroup.deleteMany({
      where: { organizationId: orgId },
    });
    console.log(`   ✅ Deleted ${groupsDeleted.count} group(s)\n`);
    
    // Step 7: Delete Contacts
    console.log('7️⃣  Deleting contacts...');
    const contactsDeleted = await prisma.contact.deleteMany({
      where: { organizationId: orgId },
    });
    console.log(`   ✅ Deleted ${contactsDeleted.count} contact(s)\n`);
    
    // Step 8: Finally delete WhatsApp Accounts
    console.log('8️⃣  Deleting WhatsApp accounts...');
    const accountsDeleted = await prisma.whatsAppAccount.deleteMany({
      where: { organizationId: orgId },
    });
    console.log(`   ✅ Deleted ${accountsDeleted.count} account(s)\n`);
    
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('✅ RESET COMPLETE!\n');
    console.log('📊 Summary:');
    console.log(`   Campaign Contacts: ${campaignContactsDeleted.count}`);
    console.log(`   Campaigns: ${campaignsDeleted.count}`);
    console.log(`   Templates: ${templatesDeleted.count}`);
    console.log(`   Conversations: ${conversationsDeleted.count}`);
    console.log(`   Group Members: ${groupMembersDeleted.count}`);
    console.log(`   Contact Groups: ${groupsDeleted.count}`);
    console.log(`   Contacts: ${contactsDeleted.count}`);
    console.log(`   WhatsApp Accounts: ${accountsDeleted.count}\n`);
    
    console.log('📱 NEXT STEPS:\n');
    console.log('1. Go to: https://wabmeta.com/settings/whatsapp');
    console.log('2. Click "Connect WhatsApp"');
    console.log('3. Log in with Facebook account that owns WABA');
    console.log('4. Select WhatsApp Business Account');
    console.log('5. Complete OAuth flow');
    console.log('6. Create fresh campaign\n');
    console.log('🎯 Everything will work perfectly now!\n');
    
  } catch (error) {
    console.error('\n❌ Error during reset:', error.message);
    console.error('\nPartial reset may have occurred.');
    console.error('Check database state before retrying.\n');
  } finally {
    await prisma.$disconnect();
  }
}

fullResetFixed();
