const { Client } = require('pg');

async function resetViaSQL() {
  console.log('Starting SQL reset...\n');
  
  let client;
  
  try {
    // Check if DATABASE_URL exists
    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL not found in environment!');
      console.error('Create .env file with DATABASE_URL\n');
      return;
    }
    
    console.log('Database URL found:', process.env.DATABASE_URL.substring(0, 20) + '...\n');
    
    client = new Client({
      connectionString: process.env.DATABASE_URL,
    });
    
    console.log('Connecting to database...');
    await client.connect();
    console.log('✅ Connected!\n');
    
    const orgId = 'cml5mjksp0003hl1jhnqufpzi';
    
    console.log('Starting deletion process...\n');
    
    // 1. Campaign contacts
    console.log('1️⃣  Deleting campaign contacts...');
    const r1 = await client.query(`
      DELETE FROM "CampaignContact" 
      WHERE "campaignId" IN (
        SELECT id FROM "Campaign" WHERE "organizationId" = $1
      )
    `, [orgId]);
    console.log(`   ✅ Deleted ${r1.rowCount} rows\n`);
    
    // 2. Campaigns
    console.log('2️⃣  Deleting campaigns...');
    const r2 = await client.query(`
      DELETE FROM "Campaign" WHERE "organizationId" = $1
    `, [orgId]);
    console.log(`   ✅ Deleted ${r2.rowCount} rows\n`);
    
    // 3. Templates
    console.log('3️⃣  Deleting templates...');
    const r3 = await client.query(`
      DELETE FROM "Template" WHERE "organizationId" = $1
    `, [orgId]);
    console.log(`   ✅ Deleted ${r3.rowCount} rows\n`);
    
    // 4. Messages
    console.log('4️⃣  Deleting messages...');
    const r4 = await client.query(`
      DELETE FROM "Message" 
      WHERE "conversationId" IN (
        SELECT id FROM "Conversation" WHERE "organizationId" = $1
      )
    `, [orgId]);
    console.log(`   ✅ Deleted ${r4.rowCount} rows\n`);
    
    // 5. Conversations
    console.log('5️⃣  Deleting conversations...');
    const r5 = await client.query(`
      DELETE FROM "Conversation" WHERE "organizationId" = $1
    `, [orgId]);
    console.log(`   ✅ Deleted ${r5.rowCount} rows\n`);
    
    // 6. Contact group members
    console.log('6️⃣  Deleting contact group members...');
    const r6 = await client.query(`
      DELETE FROM "ContactGroupMember" 
      WHERE "groupId" IN (
        SELECT id FROM "ContactGroup" WHERE "organizationId" = $1
      )
    `, [orgId]);
    console.log(`   ✅ Deleted ${r6.rowCount} rows\n`);
    
    // 7. Contact groups
    console.log('7️⃣  Deleting contact groups...');
    const r7 = await client.query(`
      DELETE FROM "ContactGroup" WHERE "organizationId" = $1
    `, [orgId]);
    console.log(`   ✅ Deleted ${r7.rowCount} rows\n`);
    
    // 8. Contacts
    console.log('8️⃣  Deleting contacts...');
    const r8 = await client.query(`
      DELETE FROM "Contact" WHERE "organizationId" = $1
    `, [orgId]);
    console.log(`   ✅ Deleted ${r8.rowCount} rows\n`);
    
    // 9. WhatsApp accounts
    console.log('9️⃣  Deleting WhatsApp accounts...');
    const r9 = await client.query(`
      DELETE FROM "WhatsAppAccount" WHERE "organizationId" = $1
    `, [orgId]);
    console.log(`   ✅ Deleted ${r9.rowCount} rows\n`);
    
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('✅ RESET COMPLETE!\n');
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
    console.log('📱 Next: https://wabmeta.com/settings/whatsapp\n');
    
  } catch (error) {
    console.error('\n❌ Detailed Error:');
    console.error('Message:', error.message);
    console.error('Code:', error.code);
    console.error('Detail:', error.detail);
    console.error('\nFull error:', error);
  } finally {
    if (client) {
      await client.end();
      console.log('Database connection closed.');
    }
  }
}

resetViaSQL();
