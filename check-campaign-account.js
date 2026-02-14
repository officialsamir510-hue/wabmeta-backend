const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSpecificAccount() {
  try {
    console.log('🔍 Checking campaign account: cmlaq05ow0001uv1jpmsugrfs\n');
    
    const account = await prisma.whatsAppAccount.findUnique({
      where: { id: 'cmlaq05ow0001uv1jpmsugrfs' },
    });
    
    if (!account) {
      console.log('❌ Account not found!\n');
      return;
    }
    
    console.log('📊 ACCOUNT DETAILS:');
    console.log(`   ID: ${account.id}`);
    console.log(`   Organization ID: ${account.organizationId}`);
    console.log(`   Phone: ${account.phoneNumber}`);
    console.log(`   Phone Number ID: ${account.phoneNumberId}`);
    console.log(`   WABA ID: ${account.wabaId}`);
    console.log(`   Status: ${account.status}`);
    console.log(`   Is Default: ${account.isDefault}`);
    console.log(`   Created: ${account.createdAt}`);
    console.log(`   Updated: ${account.updatedAt}\n`);
    
    console.log('🔐 TOKEN DETAILS:');
    console.log(`   Has Token: ${account.accessToken ? 'YES' : 'NO'}`);
    
    if (account.accessToken) {
      console.log(`   Token Length: ${account.accessToken.length}`);
      console.log(`   Token Preview: ${account.accessToken.substring(0, 50)}...`);
      console.log(`   Token Ends With: ...${account.accessToken.substring(account.accessToken.length - 20)}`);
      console.log(`   Token Expires: ${account.tokenExpiresAt || 'N/A'}`);
      
      // Check token format
      const isBase64 = /^[A-Za-z0-9+/]+=*$/.test(account.accessToken);
      const startsWithEAA = account.accessToken.startsWith('EAA');
      const startsWithU2Fsd = account.accessToken.startsWith('U2Fsd');
      
      console.log(`\n   Token Analysis:`);
      console.log(`      Is Base64: ${isBase64 ? 'YES' : 'NO'}`);
      console.log(`      Starts with EAA: ${startsWithEAA ? 'YES (Plaintext Meta)' : 'NO'}`);
      console.log(`      Starts with U2Fsd: ${startsWithU2Fsd ? 'YES (CryptoJS AES)' : 'NO'}`);
      console.log(`      First 10 chars: ${account.accessToken.substring(0, 10)}`);
      
      if (!startsWithEAA && !startsWithU2Fsd && isBase64) {
        console.log(`\n   ⚠️ ENCRYPTED with custom method (AES-256-GCM + PBKDF2)`);
        console.log(`   This is your encryption.ts format`);
        console.log(`   Decryption should work if ENCRYPTION_KEY is correct\n`);
      }
      
      // Check if expired
      if (account.tokenExpiresAt) {
        const now = new Date();
        const expired = account.tokenExpiresAt < now;
        const daysLeft = Math.floor((account.tokenExpiresAt - now) / (1000 * 60 * 60 * 24));
        
        console.log(`\n   Token Expiry:`);
        console.log(`      Expires: ${account.tokenExpiresAt}`);
        console.log(`      Expired: ${expired ? 'YES ❌' : 'NO ✅'}`);
        console.log(`      Days Left: ${daysLeft}`);
        
        if (expired) {
          console.log(`\n   ❌ TOKEN EXPIRED! Need to reconnect.\n`);
        }
      }
    } else {
      console.log('   ❌ NO TOKEN!\n');
    }
    
    // Check if belongs to correct org
    if (account.organizationId !== 'cml5mjksp0003hl1jhnqufpzi') {
      console.log(`\n⚠️ WARNING: Account belongs to different organization!`);
      console.log(`   Expected: cml5mjksp0003hl1jhnqufpzi`);
      console.log(`   Actual: ${account.organizationId}\n`);
    }
    
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('🔧 DIAGNOSIS:\n');
    
    if (!account.accessToken) {
      console.log('❌ PROBLEM: No token\n');
      console.log('SOLUTION:');
      console.log('   Reconnect this account via frontend\n');
    } else if (account.tokenExpiresAt && account.tokenExpiresAt < new Date()) {
      console.log('❌ PROBLEM: Token expired\n');
      console.log('SOLUTION:');
      console.log('   Reconnect this account via frontend\n');
    } else if (account.status !== 'CONNECTED') {
      console.log(`❌ PROBLEM: Account status is ${account.status}\n`);
      console.log('SOLUTION:');
      console.log('   Update status or reconnect account\n');
    } else {
      console.log('✅ Account looks OK!\n');
      console.log('⚠️ If still getting error, the problem is:\n');
      console.log('POSSIBLE CAUSES:');
      console.log('1. Token decryption failing in backend');
      console.log('2. ENCRYPTION_KEY different than when token was saved');
      console.log('3. Phone Number ID is invalid/changed');
      console.log('4. Meta API permissions issue\n');
      console.log('NEXT STEPS:');
      console.log('1. Check backend logs when starting campaign');
      console.log('2. Look for "[getAccountWithToken]" logs');
      console.log('3. Look for "[safeDecrypt]" logs');
      console.log('4. Check if decryption succeeds or fails\n');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkSpecificAccount();
