
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

async function test() {
  const prisma = new PrismaClient();
  try {
    const account = await prisma.whatsAppAccount.findFirst({
      where: { wabaId: '3444275699053786' }
    });

    if (!account) {
      console.log('Account not found in whatsAppAccount, checking MetaConnection...');
      const connection = await prisma.metaConnection.findFirst({
          where: { wabaId: '3444275699053786' },
          include: { phoneNumbers: true }
      });
      if (connection) {
          console.log('Found connection, using accessToken...');
          runTest(connection.accessToken, connection.wabaId);
      } else {
          console.log('No account or connection found.');
      }
    } else {
        console.log('Found account, using accessToken...');
        runTest(account.accessToken, account.wabaId);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

async function runTest(token, wabaId) {
    const versions = ['v18.0', 'v19.0', 'v20.0', 'v21.0'];
    const payloads = [
        {
            name: 'test_auto_' + Date.now(),
            language: 'en_US',
            category: 'MARKETING',
            components: [
                {
                    type: 'HEADER',
                    format: 'IMAGE',
                    example: {
                        header_handle: ['https://raw.githubusercontent.com/Meta-Open-Source/meta-open-source/main/static/img/meta-logo.png']
                    }
                },
                {
                    type: 'BODY',
                    text: 'Hello, this is a test template.'
                }
            ]
        },
        {
            name: 'test_url_auto_' + Date.now(),
            language: 'en_US',
            category: 'MARKETING',
            components: [
                {
                    type: 'HEADER',
                    format: 'IMAGE',
                    example: {
                        header_url: ['https://raw.githubusercontent.com/Meta-Open-Source/meta-open-source/main/static/img/meta-logo.png']
                    }
                },
                {
                    type: 'BODY',
                    text: 'Hello, this is a test template with header_url.'
                }
            ]
        }
    ];

    for (const v of versions) {
        for (const p of payloads) {
            console.log(`\n--- Testing ${v} with ${p.components[0].example.header_handle ? 'header_handle' : 'header_url'} ---`);
            try {
                const res = await axios.post(`https://graph.facebook.com/${v}/${wabaId}/message_templates`, p, {
                    params: { access_token: token }
                });
                console.log(`✅ Success! Template ID: ${res.data.id}`);
            } catch (err) {
                console.log(`❌ Failed: status ${err.response?.status}, message: ${err.response?.data?.error?.message}`);
                console.log(`   Subcode: ${err.response?.data?.error?.error_subcode}, Title: ${err.response?.data?.error?.error_user_title}`);
            }
        }
    }
}

test();
