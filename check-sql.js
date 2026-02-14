const { Client } = require('pg');

async function checkViaSQL() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    await client.connect();
    console.log('Connected to database\n');
    
    // Query the specific account
    const accountQuery = `
      SELECT 
        id,
        "organizationId",
        "phoneNumber",
        "phoneNumberId",
        "wabaId",
        status,
        "isDefault",
        CASE 
          WHEN "accessToken" IS NULL THEN 'NO'
          ELSE 'YES'
        END as has_token,
        LENGTH("accessToken") as token_length,
        LEFT("accessToken", 30) as token_preview,
        "tokenExpiresAt",
        "createdAt",
        "updatedAt"
      FROM "WhatsAppAccount"
      WHERE id = 'cmlaq05ow0001uv1jpmsugrfs'
    `;
    
    const result = await client.query(accountQuery);
    
    if (result.rows.length === 0) {
      console.log('❌ Account NOT FOUND!\n');
      
      // List all accounts
      const allQuery = `
        SELECT 
          id,
          "phoneNumber",
          status,
          CASE WHEN "accessToken" IS NULL THEN 'NO' ELSE 'YES' END as has_token
        FROM "WhatsAppAccount"
        WHERE "organizationId" = 'cml5mjksp0003hl1jhnqufpzi'
        ORDER BY "createdAt" DESC
      `;
      
      const allResult = await client.query(allQuery);
      console.log('Available accounts:\n');
      allResult.rows.forEach((row, i) => {
        console.log(`${i + 1}. ${row.phoneNumber} - ${row.status} - Token: ${row.has_token}`);
      });
      
    } else {
      const acc = result.rows[0];
      
      console.log('✅ ACCOUNT FOUND!\n');
      console.log('Details:');
      console.log('  ID:', acc.id);
      console.log('  Phone:', acc.phoneNumber);
      console.log('  Phone Number ID:', acc.phoneNumberId);
      console.log('  WABA ID:', acc.wabaId);
      console.log('  Status:', acc.status);
      console.log('  Has Token:', acc.has_token);
      console.log('  Token Length:', acc.token_length || 0);
      
      if (acc.has_token === 'YES') {
        console.log('  Token Preview:', acc.token_preview + '...');
        console.log('  Token Expires:', acc.tokenExpiresAt || 'N/A');
        
        const startsWithEAA = acc.token_preview?.startsWith('EAA');
        console.log('  Format:', startsWithEAA ? 'PLAINTEXT' : 'ENCRYPTED');
      }
      
      console.log('\n═══════════════════════════════════════\n');
      console.log('DIAGNOSIS:\n');
      
      if (acc.has_token === 'NO') {
        console.log('❌ NO TOKEN!');
        console.log('Solution: Reconnect via frontend\n');
      } else if (acc.status !== 'CONNECTED') {
        console.log(`❌ Status is ${acc.status}`);
        console.log('Solution: Reconnect or update status\n');
      } else if (acc.tokenExpiresAt && new Date(acc.tokenExpiresAt) < new Date()) {
        console.log('❌ TOKEN EXPIRED!');
        console.log('Solution: Reconnect via frontend\n');
      } else {
        console.log('✅ Account looks GOOD!');
        console.log('\nIf still getting error:');
        console.log('- Token decryption failing in backend');
        console.log('- Check backend logs for [safeDecrypt] errors');
        console.log('- Or Phone Number ID is invalid\n');
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkViaSQL();
