const { PrismaClient } = require('@prisma/client');
const { encrypt } = require('./src/utils/encryption');
const prisma = new PrismaClient();

async function injectToken() {
  // PASTE YOUR META TOKEN HERE (from Graph API Explorer)
  const metaToken = 'PASTE_TOKEN_HERE';
  
  if (!metaToken.startsWith('EAA')) {
    console.error('? Invalid Meta token. Must start with EAA');
    return;
  }

  console.log('?? Encrypting token...');
  const encryptedToken = encrypt(metaToken);
  
  console.log('?? Saving to database...');
  const result = await prisma.whatsAppAccount.update({
    where: { id: 'cmlhn1hzb00167yxy76uk3v1w' },
    data: {
      accessToken: encryptedToken,
      tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      status: 'CONNECTED',
    },
  });

  console.log('? Token updated!');
  console.log('   Status:', result.status);
  
  // Verify decryption
  const { safeDecrypt } = require('./src/utils/encryption');
  const decrypted = safeDecrypt(encryptedToken);
  console.log('?? Verification:');
  console.log('   Decrypts OK:', !!decrypted);
  console.log('   Is Meta Token:', decrypted?.startsWith('EAA'));
  
  await prisma.$disconnect();
}

injectToken();
