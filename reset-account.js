const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetAccount() {
  try {
    console.log('?? Resetting WhatsApp account...');
    
    const result = await prisma.whatsAppAccount.update({
      where: { id: 'cmlhn1hzb00167yxy76uk3v1w' },
      data: {
        status: 'DISCONNECTED',
        accessToken: null,
        tokenExpiresAt: null,
      },
    });

    console.log('? Account reset successfully!');
    console.log('   ID:', result.id);
    console.log('   Status:', result.status);
    console.log('   Phone:', result.phoneNumber);
    console.log('   Token removed:', result.accessToken === null);
    console.log('');
    console.log('?? Next step: Go to https://wabmeta.com/settings');
    console.log('   Click "Connect WhatsApp" to reconnect');
  } catch (error) {
    console.error('? Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

resetAccount();
