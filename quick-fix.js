require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function quickFix() {
  try {
    console.log('🔄 Resetting WhatsApp account...\n');
    
    await prisma.whatsAppAccount.update({
      where: { id: 'cmlm88994000113fl7vw7tcm7' },
      data: {
        status: 'DISCONNECTED',
        accessToken: null,
        tokenExpiresAt: null,
      },
    });
    
    console.log('✅ Account reset!\n');
    console.log('📱 NEXT STEPS:\n');
    console.log('1. Go to: https://wabmeta.com/settings/whatsapp');
    console.log('2. You will see "Disconnected" status');
    console.log('3. Click "Connect WhatsApp" or "Reconnect"');
    console.log('4. Login with Facebook');
    console.log('5. Complete OAuth');
    console.log('6. Delete old campaign');
    console.log('7. Create NEW campaign');
    console.log('8. Start → Will work! ✅\n');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

quickFix();
