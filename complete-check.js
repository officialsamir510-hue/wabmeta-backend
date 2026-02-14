const { PrismaClient } = require('@prisma/client');

async function completeCheck() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Checking campaign account...\n');
    
    const account = await prisma.whatsAppAccount.findUnique({
      where: { id: 'cmlaq05ow0001uv1jpmsugrfs' },
    });
    
    if (!account) {
      console.log('Account NOT FOUND!\n');
      console.log('Listing all accounts:\n');
      
      const all = await prisma.whatsAppAccount.findMany({
        where: { organizationId: 'cml5mjksp0003hl1jhnqufpzi' },
      });
      
      all.forEach((a, i) => {
        console.log(`${i + 1}. ${a.phoneNumber} - ${a.status} - Token: ${a.accessToken ? 'YES' : 'NO'}`);
      });
      
      return;
    }
    
    console.log('Account Found:');
    console.log('  Phone:', account.phoneNumber);
    console.log('  Status:', account.status);
    console.log('  Has Token:', account.accessToken ? 'YES' : 'NO');
    console.log('  Token Length:', account.accessToken?.length || 0);
    
    if (account.accessToken) {
      console.log('  Token Preview:', account.accessToken.substring(0, 30) + '...');
      console.log('  Format:', account.accessToken.startsWith('EAA') ? 'PLAINTEXT' : 'ENCRYPTED');
    }
    
    console.log('\nDiagnosis:');
    if (!account.accessToken) {
      console.log('  Problem: NO TOKEN');
      console.log('  Solution: Reconnect via frontend');
    } else if (account.status !== 'CONNECTED') {
      console.log('  Problem: Status is', account.status);
      console.log('  Solution: Reconnect via frontend');
    } else {
      console.log('  Account looks OK');
      console.log('  If still error, check backend decryption logs');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

completeCheck();
