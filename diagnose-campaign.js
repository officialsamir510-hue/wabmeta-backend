require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function diagnoseIssue() {
  try {
    console.log('🔍 DIAGNOSING CAMPAIGN ISSUE\n');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    // 1. Get campaign details
    const campaignId = 'cmlm8b49y000e13flpszftf1n';
    
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        whatsappAccount: true,
        template: true,
      },
    });
    
    if (!campaign) {
      console.log('❌ Campaign not found!\n');
      return;
    }
    
    console.log('📊 CAMPAIGN INFO:');
    console.log('  ID:', campaign.id);
    console.log('  Name:', campaign.name);
    console.log('  Status:', campaign.status);
    console.log('  Template:', campaign.template?.name);
    console.log('  WhatsApp Account ID:', campaign.whatsappAccountId);
    console.log('');
    
    // 2. Check WhatsApp account
    if (!campaign.whatsappAccount) {
      console.log('❌ PROBLEM: Campaign has no WhatsApp account!\n');
      console.log('SOLUTION:');
      console.log('1. Delete this campaign');
      console.log('2. Create new campaign');
      console.log('3. Select WhatsApp account\n');
      return;
    }
    
    const acc = campaign.whatsappAccount;
    
    console.log('📱 WHATSAPP ACCOUNT:');
    console.log('  ID:', acc.id);
    console.log('  Phone:', acc.phoneNumber);
    console.log('  Phone Number ID:', acc.phoneNumberId);
    console.log('  Status:', acc.status);
    console.log('  Has Token:', acc.accessToken ? 'YES' : 'NO');
    
    if (acc.accessToken) {
      console.log('  Token Length:', acc.accessToken.length);
      console.log('  Token Preview:', acc.accessToken.substring(0, 30) + '...');
      console.log('  Token Format:', acc.accessToken.startsWith('EAA') ? 'PLAINTEXT' : 'ENCRYPTED');
    }
    
    console.log('');
    
    // 3. Diagnosis
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('🔧 DIAGNOSIS:\n');
    
    if (!acc.accessToken) {
      console.log('❌ NO TOKEN!\n');
      console.log('CAUSE: WhatsApp account has no access token\n');
      console.log('SOLUTION:');
      console.log('1. Go to https://wabmeta.com/settings/whatsapp');
      console.log('2. Find account:', acc.phoneNumber);
      console.log('3. Click "Disconnect"');
      console.log('4. Click "Connect WhatsApp"');
      console.log('5. Complete OAuth\n');
    } else if (acc.status !== 'CONNECTED') {
      console.log(`❌ Account status is ${acc.status}!\n`);
      console.log('SOLUTION: Reconnect account via frontend\n');
    } else {
      console.log('✅ Account has token and is CONNECTED\n');
      console.log('⚠️ PROBLEM: Token decryption failing in backend\n');
      console.log('CAUSES:');
      console.log('1. ENCRYPTION_KEY different in backend');
      console.log('2. Token encrypted with different key');
      console.log('3. Decryption logic issue\n');
      console.log('SOLUTION:');
      console.log('Run this to reset token:\n');
      console.log(`UPDATE "WhatsAppAccount" SET status = 'DISCONNECTED', "accessToken" = NULL WHERE id = '${acc.id}';`);
      console.log('\nThen reconnect via frontend\n');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

diagnoseIssue();
