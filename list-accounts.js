const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listAllAccounts() {
  try {
    const accounts = await prisma.whatsAppAccount.findMany({
      where: { organizationId: 'cml5mjksp0003hl1jhnqufpzi' },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`?? Total WhatsApp Accounts: ${accounts.length}\n`);

    if (accounts.length === 0) {
      console.log('? No WhatsApp accounts found!');
      console.log('   Go to https://wabmeta.com/settings and connect WhatsApp');
      return;
    }

    accounts.forEach((acc, i) => {
      console.log(`????????????????????????????????????`);
      console.log(`Account #${i + 1}:`);
      console.log(`   ID: ${acc.id}`);
      console.log(`   Phone: ${acc.phoneNumber}`);
      console.log(`   Phone Number ID: ${acc.phoneNumberId}`);
      console.log(`   Status: ${acc.status}`);
      console.log(`   Is Default: ${acc.isDefault}`);
      console.log(`   Has Token: ${acc.accessToken ? 'YES ?' : 'NO ?'}`);
      console.log(`   Token Length: ${acc.accessToken?.length || 0}`);
      console.log(`   Expires: ${acc.tokenExpiresAt || 'N/A'}`);
      console.log(`   Created: ${acc.createdAt}`);
      console.log(`   Updated: ${acc.updatedAt}`);
      
      if (acc.id === 'cmlhn1hzb00167yxy76uk3v1w') {
        console.log(`   ? THIS IS THE ACCOUNT WE RESET`);
      }
    });

    console.log(`????????????????????????????????????\n`);

  } catch (error) {
    console.error('? Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

listAllAccounts();
