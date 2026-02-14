const { Client } = require('pg');

async function resetViaSQL() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    const orgId = 'cml5mjksp0003hl1jhnqufpzi';
    
    console.log('🗑️  Deleting data via SQL...\n');
    
    // Delete in correct order
    console.log('1️⃣  Campaign contacts...');
    await client.query(`
      DELETE FROM "CampaignContact" 
      WHERE "campaignId" IN (
        SELECT id FROM "Campaign" WHERE "organizationId" = $1
      )
    `, [orgId]);
    console.log('   ✅ Done\n');
    
    console.log('2️⃣  Campaigns...');
    await client.query(`
      DELETE FROM "Campaign" WHERE "organizationId" = $1
    `, [orgId]);
    console.log('   ✅ Done\n');
    
    console.log('3️⃣  Templates...');
    await client.query(`
      DELETE FROM "Template" WHERE "organizationId" = $1
    `, [orgId]);
    console.log('   ✅ Done\n');
    
    console.log('4️⃣  Messages...');
    await client.query(`
      DELETE FROM "Message" 
      WHERE "conversationId" IN (
        SELECT id FROM "Conversation" WHERE "organizationId" = $1
      )
    `, [orgId]);
    console.log('   ✅ Done\n');
    
    console.log('5️⃣  Conversations...');
    await client.query(`
      DELETE FROM "Conversation" WHERE "organizationId" = $1
    `, [orgId]);
    console.log('   ✅ Done\n');
    
    console.log('6️⃣  Contact group members...');
    await client.query(`
      DELETE FROM "ContactGroupMember" 
      WHERE "groupId" IN (
        SELECT id FROM "ContactGroup" WHERE "organizationId" = $1
      )
    `, [orgId]);
    console.log('   ✅ Done\n');
    
    console.log('7️⃣  Contact groups...');
    await client.query(`
      DELETE FROM "ContactGroup" WHERE "organizationId" = $1
    `, [orgId]);
    console.log('   ✅ Done\n');
    
    console.log('8️⃣  Contacts...');
    await client.query(`
      DELETE FROM "Contact" WHERE "organizationId" = $1
    `, [orgId]);
    console.log('   ✅ Done\n');
    
    console.log('9️⃣  WhatsApp accounts...');
    await client.query(`
      DELETE FROM "WhatsAppAccount" WHERE "organizationId" = $1
    `, [orgId]);
    console.log('   ✅ Done\n');
    
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('✅ RESET COMPLETE VIA SQL!\n');
    console.log('📱 Now connect WhatsApp via frontend:\n');
    console.log('   https://wabmeta.com/settings/whatsapp\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

resetViaSQL();
