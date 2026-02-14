require('dotenv').config();
const { Client } = require('pg');

async function resetViaSQL() {
  console.log('🔧 Loading environment variables...\n');
  
  // Check if DATABASE_URL exists
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL still not found!\n');
    console.error('Check if .env file exists in current directory:');
    console.error('   ' + process.cwd() + '\\.env\n');
    return;
  }
  
  console.log('✅ DATABASE_URL loaded\n');
  console.log('📍 Database:', process.env.DATABASE_URL.split('@')[1]?.split('/')[0] || 'hidden');
  
  let client;
  
  try {
    client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
    });
    
    console.log('\n🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected!\n');
    
    const orgId = 'cml5mjksp0003hl1jhnqufpzi';
    
    console.log('🗑️  Starting deletion process...\n');
    
    // 1. Campaign contacts
    console.log('1️⃣  Campaign contacts...');
    const r1 = await client.query(`
      DELETE FROM "CampaignContact" 
      WHERE "campaignId" IN (
        SELECT id FROM "Campaign" WHERE "organizationId" = $1
      )
    `, [orgId]);
    console.log(`   ✅ ${r1.rowCount} deleted\n`);
    
    // 2. Campaigns
    console.log('2️⃣  Campaigns...');
    const r2 = await client.query(`
      DELETE FROM "Campaign" WHERE "organizationId" = $1
    `, [orgId]);
    console.log(`   ✅ ${r2.rowCount} deleted\n`);
    
    // 3. Templates
    console.log('3️⃣  Templates...');
    const r3 = await client.query(`
      DELETE FROM "Template" WHERE "organizationId" = $1
    `, [orgId]);
    console.log(`   ✅ ${r3.rowCount} deleted\n`);
    
    // 4. Messages
    console.log('4️⃣  Messages...');
    const r4 = await client.query(`
      DELETE FROM "Message" 
      WHERE "conversationId" IN (
        SELECT id FROM "Conversation" WHERE "organizationId" = $1
      )
    `, [orgId]);
    console.log(`   ✅ ${r4.rowCount} deleted\n`);
    
    // 5. Conversations
    console.log('5️⃣  Conversations...');
    const r5 = await client.query(`
      DELETE FROM "Conversation" WHERE "organizationId" = $1
    `, [orgId]);
    console.log(`   ✅ ${r5.rowCount} deleted\n`);
    
    // 6. Contact group members
    console.log('6️⃣  Contact group members...');
    const r6 = await client.query(`
      DELETE FROM "ContactGroupMember" 
      WHERE "groupId" IN (
        SELECT id FROM "ContactGroup" WHERE "organizationId" = $1
      )
    `, [orgId]);
    console.log(`   ✅ ${r6.rowCount} deleted\n`);
    
    // 7. Contact groups
    console.log('7️⃣  Contact groups...');
    const r7 = await client.query(`
      DELETE FROM "ContactGroup" WHERE "organizationId" = $1
    `, [orgId]);
    console.log(`   ✅ ${r7.rowCount} deleted\n`);
    
    // 8. Contacts
    console.log('8️⃣  Contacts...');
    const r8 = await client.query(`
      DELETE FROM "Contact" WHERE "organizationId" = $1
    `, [orgId]);
    console.log(`   ✅ ${r8.rowCount} deleted\n`);
    
    // 9. WhatsApp accounts
    console.log('9️⃣  WhatsApp accounts...');
    const r9 = await client.query(`
      DELETE FROM "WhatsAppAccount" WHERE "organizationId" = $1
    `, [orgId]);
    console.log(`   ✅ ${r9.rowCount} deleted\n`);
    
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('🎉 RESET COMPLETE!\n');
    console.log('📊 Summary:');
    console.log(`   Campaign Contacts: ${r1.rowCount}`);
    console.log(`   Campaigns: ${r2.rowCount}`);
    console.log(`   Templates: ${r3.rowCount}`);
    console.log(`   Messages: ${r4.rowCount}`);
    console.log(`   Conversations: ${r5.rowCount}`);
    console.log(`   Group Members: ${r6.rowCount}`);
    console.log(`   Contact Groups: ${r7.rowCount}`);
    console.log(`   Contacts: ${r8.rowCount}`);
    console.log(`   WhatsApp Accounts: ${r9.rowCount}\n`);
    
    console.log('📱 NEXT STEPS:\n');
    console.log('1. Go to: https://wabmeta.com/settings/whatsapp');
    console.log('2. Click "Connect WhatsApp"');
    console.log('3. Login with Facebook account that owns WABA');
    console.log('4. Select WhatsApp Business Account');
    console.log('5. Complete OAuth flow\n');
    console.log('✅ Everything will work perfectly now!\n');
    
  } catch (error) {
    console.error('\n❌ Error occurred:');
    console.error('Message:', error.message);
    if (error.code) console.error('Code:', error.code);
    if (error.detail) console.error('Detail:', error.detail);
  } finally {
    if (client) {
      await client.end();
    }
  }
}

resetViaSQL();
