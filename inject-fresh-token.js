const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function injectFreshToken() {
  // ⚠️ PASTE YOUR FRESH META TOKEN HERE (from Graph API Explorer)
  const metaToken = 'EAAUZAGLR86oIBQiEXsseunkVGuDiEuiicmIMwocJFnIeQT5mWnlgTO4ncT94f6eWxPd59U2QHEw1D2usYMqD5GqZCqPZAtnxZAt1rScJDot8gJZC7D2OZCN6ZBOCuv78yCwsjOr0JVinMve1guQHoR5kapiCS4j1lhev3OdTJ38xcKDvDGXyEubeVCfLvwhVjrpkRd2Gnm4VF5jCNNeIMU28mlZA5lvdhe61PZAOoHtjzyEckJzEWY6zZBZCmcADdGjkK83XZAhu1X0VGrCwV5o8ruER6Hy8';

  if (!metaToken || metaToken === 'PASTE_YOUR_EAA_TOKEN_HERE') {
    console.error('❌ Please edit this file and paste your Meta token!');
    console.error('   Get token from: https://developers.facebook.com/tools/explorer/');
    process.exit(1);
  }

  if (!metaToken.startsWith('EAA')) {
    console.error('❌ Invalid token format! Must start with EAA');
    console.error('   Your token starts with:', metaToken.substring(0, 10));
    process.exit(1);
  }

  console.log('📝 Token received:', metaToken.substring(0, 20) + '...');
  console.log('📏 Token length:', metaToken.length);

  console.log('\n💾 Saving token to database...');

  const result = await prisma.whatsAppAccount.update({
    where: { id: 'cmlhn1hzb00167yxy76uk3v1w' },
    data: {
      accessToken: metaToken, // Save as PLAINTEXT (safeDecrypt handles this)
      tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
      status: 'CONNECTED',
    },
  });

  console.log('✅ Token saved successfully!');
  console.log('   Account ID:', result.id);
  console.log('   Status:', result.status);
  console.log('   Phone:', result.phoneNumber);
  console.log('   Token length:', result.accessToken?.length);
  console.log('   Expires:', result.tokenExpiresAt);

  console.log('\n📝 Token Analysis:');
  console.log('   Saved as: PLAINTEXT');
  console.log('   Format: Meta Access Token');
  console.log('   Your safeDecrypt() will recognize this automatically');

  console.log('\n🎯 NEXT STEP:');
  console.log('   Go to your campaign and click "Start"');
  console.log('   Messages should send successfully now!');

  await prisma.$disconnect();
}

injectFreshToken().catch(console.error);
