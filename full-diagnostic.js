const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fullDiagnostic() {
  console.log('🔍 FULL DIAGNOSTIC REPORT\n');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  try {
    // 1. Check Organization
    console.log('1️⃣ ORGANIZATION:');
    const org = await prisma.organization.findUnique({
      where: { id: 'cml5mjksp0003hl1jhnqufpzi' },
    });
    
    if (!org) {
      console.log('   ❌ Organization not found!');
      return;
    }
    
    console.log(`   ID: ${org.id}`);
    console.log(`   Name: ${org.name}`);
    console.log(`   Plan: ${org.planType}\n`);
    
    // 2. Check WhatsApp Accounts
    console.log('2️⃣ WHATSAPP ACCOUNTS:');
    const accounts = await prisma.whatsAppAccount.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: 'desc' },
    });
    
    console.log(`   Total: ${accounts.length}\n`);
    
    if (accounts.length === 0) {
      console.log('   ❌ NO ACCOUNTS FOUND!\n');
      console.log('   ACTION: Go to https://wabmeta.com/settings/whatsapp');
      console.log('           Click "Connect WhatsApp"\n');
      return;
    }
    
    accounts.forEach((acc, i) => {
      console.log(`   Account #${i + 1}:`);
      console.log(`      ID: ${acc.id}`);
      console.log(`      Phone: ${acc.phoneNumber}`);
      console.log(`      Phone Number ID: ${acc.phoneNumberId}`);
      console.log(`      WABA ID: ${acc.wabaId}`);
      console.log(`      Status: ${acc.status}`);
      console.log(`      Is Default: ${acc.isDefault}`);
      console.log(`      Has Token: ${acc.accessToken ? 'YES' : 'NO'}`);
      
      if (acc.accessToken) {
        console.log(`      Token Length: ${acc.accessToken.length}`);
        console.log(`      Token Preview: ${acc.accessToken.substring(0, 20)}...`);
        console.log(`      Token Format: ${acc.accessToken.startsWith('EAA') ? 'PLAINTEXT META' : 'ENCRYPTED'}`);
      }
      
      console.log(`      Token Expires: ${acc.tokenExpiresAt || 'N/A'}`);
      console.log(`      Created: ${acc.createdAt}`);
      console.log(`      Updated: ${acc.updatedAt}`);
      console.log('');
    });
    
    // 3. Check Latest Campaign
    console.log('3️⃣ LATEST CAMPAIGN:');
    const campaign = await prisma.campaign.findFirst({
      where: { id: 'cmlkz2ttb001dy83f2fds5k4o' },
      include: { 
        whatsappAccount: true,
        template: true,
      },
    });
    
    if (!campaign) {
      console.log('   ❌ Campaign not found!\n');
    } else {
      console.log(`   ID: ${campaign.id}`);
      console.log(`   Name: ${campaign.name}`);
      console.log(`   Status: ${campaign.status}`);
      console.log(`   Template: ${campaign.template?.name || 'N/A'}`);
      console.log(`   WhatsApp Account ID: ${campaign.whatsappAccountId}\n`);
      
      if (campaign.whatsappAccount) {
        console.log('   Campaign is using:');
        console.log(`      Phone: ${campaign.whatsappAccount.phoneNumber}`);
        console.log(`      Status: ${campaign.whatsappAccount.status}`);
        console.log(`      Has Token: ${campaign.whatsappAccount.accessToken ? 'YES' : 'NO'}`);
        
        if (campaign.whatsappAccount.accessToken) {
          console.log(`      Token Length: ${campaign.whatsappAccount.accessToken.length}`);
        }
        console.log('');
        
        if (!campaign.whatsappAccount.accessToken) {
          console.log('   ⚠️ PROBLEM: Campaign account has NO TOKEN!\n');
        }
        
        if (campaign.whatsappAccount.status !== 'CONNECTED') {
          console.log(`   ⚠️ PROBLEM: Account status is ${campaign.whatsappAccount.status}!\n`);
        }
      } else {
        console.log('   ❌ PROBLEM: Campaign has no WhatsApp account linked!\n');
      }
    }
    
    // 4. Check if multiple accounts exist
    if (accounts.length > 1) {
      console.log('4️⃣ MULTIPLE ACCOUNTS DETECTED:\n');
      console.log('   You have multiple WhatsApp accounts.');
      console.log('   Make sure campaigns use the correct account.\n');
      
      const connectedAccounts = accounts.filter(a => a.status === 'CONNECTED' && a.accessToken);
      console.log(`   Connected accounts with token: ${connectedAccounts.length}\n`);
      
      if (connectedAccounts.length === 0) {
        console.log('   ❌ NO ACCOUNT HAS VALID TOKEN!\n');
      } else {
        console.log('   Accounts with valid tokens:');
        connectedAccounts.forEach(acc => {
          console.log(`      - ${acc.phoneNumber} (${acc.id})`);
        });
        console.log('');
      }
    }
    
    // 5. Summary
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('📋 SUMMARY:\n');
    
    const validAccounts = accounts.filter(a => 
      a.status === 'CONNECTED' && 
      a.accessToken && 
      a.accessToken.length > 50
    );
    
    if (validAccounts.length === 0) {
      console.log('❌ NO VALID WHATSAPP ACCOUNTS\n');
      console.log('ACTION REQUIRED:');
      console.log('1. Go to: https://wabmeta.com/settings/whatsapp');
      console.log('2. Disconnect all existing accounts (if any)');
      console.log('3. Click "Connect WhatsApp"');
      console.log('4. Complete Meta OAuth flow');
      console.log('5. Create new campaign\n');
    } else {
      console.log(`✅ ${validAccounts.length} Valid Account(s) Found\n`);
      
      if (campaign && campaign.whatsappAccount) {
        const isValid = validAccounts.some(a => a.id === campaign.whatsappAccountId);
        
        if (isValid) {
          console.log('✅ Campaign is using a valid account\n');
          console.log('⚠️ BUT STILL GETTING ERROR?\n');
          console.log('POSSIBLE CAUSES:');
          console.log('1. Token decryption failing in backend');
          console.log('2. Wrong Phone Number ID');
          console.log('3. Token expired (check tokenExpiresAt)');
          console.log('4. Backend ENCRYPTION_KEY changed\n');
          console.log('NEXT STEPS:');
          console.log('1. Check backend logs when starting campaign');
          console.log('2. Look for decryption errors');
          console.log('3. Verify ENCRYPTION_KEY in .env\n');
        } else {
          console.log('❌ Campaign is using an INVALID account\n');
          console.log('ACTION:');
          console.log('1. Delete this campaign');
          console.log('2. Create new campaign');
          console.log(`3. Select account: ${validAccounts[0].phoneNumber}\n`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fullDiagnostic();
