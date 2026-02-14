const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkStatus() {
  try {
    const account = await prisma.whatsAppAccount.findUnique({
      where: { id: 'cmlhn1hzb00167yxy76uk3v1w' },
    });

    if (!account) {
      console.log('? Account not found!');
      return;
    }

    console.log('?? WhatsApp Account Status:');
    console.log('   ID:', account.id);
    console.log('   Status:', account.status);
    console.log('   Phone:', account.phoneNumber);
    console.log('   Phone Number ID:', account.phoneNumberId);
    console.log('   Has Token:', !!account.accessToken);
    console.log('   Token Length:', account.accessToken?.length || 0);
    console.log('   Token Expires:', account.tokenExpiresAt);
    console.log('   Created:', account.createdAt);
    console.log('   Updated:', account.updatedAt);
    
    if (account.accessToken) {
      console.log('\n?? Token Info:');
      console.log('   First 30 chars:', account.accessToken.substring(0, 30) + '...');
      console.log('   Last 10 chars:', '...' + account.accessToken.substring(account.accessToken.length - 10));
      
      const isBase64 = /^[A-Za-z0-9+/]+=*$/.test(account.accessToken);
      console.log('   Is Base64:', isBase64 ? 'YES' : 'NO');
      
      const startsWithEAA = account.accessToken.startsWith('EAA');
      console.log('   Starts with EAA:', startsWithEAA ? 'YES (PLAINTEXT)' : 'NO (ENCRYPTED)');
    } else {
      console.log('\n?? NO TOKEN - Need to reconnect via frontend!');
    }

    console.log('\n? Next Steps:');
    if (!account.accessToken) {
      console.log('   1. Go to https://wabmeta.com/settings');
      console.log('   2. Click "Connect WhatsApp"');
      console.log('   3. Complete Meta OAuth flow');
    } else if (account.status === 'DISCONNECTED') {
      console.log('   Account has token but marked as DISCONNECTED');
      console.log('   Try reconnecting via frontend');
    } else {
      console.log('   Account looks OK, but decryption might be failing');
      console.log('   Check backend logs when starting campaign');
    }

  } catch (error) {
    console.error('? Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkStatus();
