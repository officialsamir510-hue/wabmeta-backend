
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

async function test() {
  const prisma = new PrismaClient();
  try {
    const account = await prisma.whatsAppAccount.findFirst({
      where: { wabaId: '3444275699053786' }
    });

    const { safeDecryptStrict } = require('../utils/encryption');

    if (!account) {
      console.log('Account not found in whatsAppAccount, checking MetaConnection...');
      const connection = await prisma.metaConnection.findFirst({
          where: { wabaId: '3444275699053786' }
      });
      if (connection) {
          console.log('Found connection, decrypting token...');
          const decrypted = safeDecryptStrict(connection.accessToken);
          await runTest(decrypted, connection.wabaId);
      } else {
          console.log('No account or connection found.');
      }
    } else {
        console.log('Found account, decrypting token...');
        const decrypted = safeDecryptStrict(account.accessToken);
        await runTest(decrypted, account.wabaId);
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

    const fs = require('fs');
    const logFile = 'src/tmp/results.log';
    fs.writeFileSync(logFile, 'Test Results:\n');

    for (const v of versions) {
        for (const p of payloads) {
            const logMsg = `\n--- Testing ${v} with ${p.components[0].example.header_handle ? 'header_handle' : 'header_url'} ---\n`;
            console.log(logMsg);
            fs.appendFileSync(logFile, logMsg);
            try {
                const res = await axios.post(`https://graph.facebook.com/${v}/${wabaId}/message_templates`, p, {
                    params: { access_token: token }
                });
                const successMsg = `✅ Success! Template ID: ${res.data.id}\n`;
                console.log(successMsg);
                fs.appendFileSync(logFile, successMsg);
            } catch (err) {
                const errMsg = `❌ Failed: status ${err.response?.status}, message: ${err.response?.data?.error?.message}\n   Subcode: ${err.response?.data?.error?.error_subcode}, Title: ${err.response?.data?.error?.error_user_title}\n`;
                console.log(errMsg);
                fs.appendFileSync(logFile, errMsg);
            }
        }
    }
}

test();
