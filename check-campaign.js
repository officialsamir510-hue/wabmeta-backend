const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCampaign() {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: 'cmlkxxos3000ay83fj4gmtl8x' },
      include: {
        whatsappAccount: true,
      },
    });

    if (!campaign) {
      console.log('? Campaign not found!');
      return;
    }

    console.log('?? Campaign Details:');
    console.log('   ID:', campaign.id);
    console.log('   Name:', campaign.name);
    console.log('   Status:', campaign.status);
    console.log('   WhatsApp Account ID:', campaign.whatsappAccountId);
    
    if (campaign.whatsappAccount) {
      console.log('\n?? Campaign is using this WhatsApp Account:');
      console.log('   ID:', campaign.whatsappAccount.id);
      console.log('   Phone:', campaign.whatsappAccount.phoneNumber);
      console.log('   Status:', campaign.whatsappAccount.status);
      console.log('   Has Token:', !!campaign.whatsappAccount.accessToken);
      console.log('   Token Length:', campaign.whatsappAccount.accessToken?.length || 0);
      
      if (!campaign.whatsappAccount.accessToken) {
        console.log('\n?? THIS IS THE PROBLEM:');
        console.log('   Campaign is using account with NO TOKEN!');
      }
    } else {
      console.log('\n? Campaign has no WhatsApp account linked!');
    }

  } catch (error) {
    console.error('? Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkCampaign();
