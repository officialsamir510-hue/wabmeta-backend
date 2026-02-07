// src/modules/meta/meta.service.ts

static async handleOAuthCallback(code: string, state: string) {
  try {
    // Decode state
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    const { organizationId, userId } = stateData;

    console.log('OAuth callback for org:', organizationId);

    // Verify organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: { metaConnection: true }
    });

    if (!organization) {
      throw new Error('Organization not found');
    }

    // Exchange code for token
    const api = new MetaGraphAPI();
    const tokenResponse = await api.exchangeCodeForToken(code);

    console.log('Token exchanged successfully');

    // Get long-lived token (60 days)
    const longLivedToken = await api.getLongLivedToken(tokenResponse.access_token);

    // Get accessible WABAs for this user
    const wabas = await api.getAccessibleWABAs(longLivedToken.access_token);

    if (!wabas || wabas.length === 0) {
      throw new Error('No WhatsApp Business Account found. Please create one in Meta Business Suite first.');
    }

    console.log(`Found ${wabas.length} WABAs`);

    // If multiple WABAs, use first one (or implement selection UI)
    const selectedWaba = wabas[0];

    // Get phone numbers for selected WABA
    const phoneNumbers = await api.getPhoneNumbers(selectedWaba.id, longLivedToken.access_token);

    if (!phoneNumbers || phoneNumbers.length === 0) {
      throw new Error('No phone numbers found. Please add a phone number to your WhatsApp Business Account.');
    }

    console.log(`Found ${phoneNumbers.length} phone numbers`);

    // Encrypt access token before storing
    const encryptedToken = EncryptionUtil.encrypt(longLivedToken.access_token);

    // Calculate token expiry (60 days for long-lived token)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 60);

    // Store or update MetaConnection for this organization
    const metaConnection = await prisma.metaConnection.upsert({
      where: { organizationId },
      create: {
        organizationId,
        accessToken: encryptedToken,
        accessTokenExpiresAt: expiresAt,
        wabaId: selectedWaba.id,
        wabaName: selectedWaba.name,
        status: 'CONNECTED',
        lastSyncedAt: new Date(),
        messagingLimit: phoneNumbers[0]?.messaging_limit_tier || 'TIER_1'
      },
      update: {
        accessToken: encryptedToken,
        accessTokenExpiresAt: expiresAt,
        wabaId: selectedWaba.id,
        wabaName: selectedWaba.name,
        status: 'CONNECTED',
        lastSyncedAt: new Date(),
        errorMessage: null,
        messagingLimit: phoneNumbers[0]?.messaging_limit_tier || 'TIER_1'
      }
    });

    // Store phone numbers for this organization
    for (const phone of phoneNumbers) {
      await prisma.phoneNumber.upsert({
        where: { phoneNumberId: phone.id },
        create: {
          metaConnectionId: metaConnection.id,
          phoneNumberId: phone.id,
          phoneNumber: phone.display_phone_number,
          displayName: phone.display_phone_number,
          verifiedName: phone.verified_name,
          qualityRating: phone.quality_rating || 'UNKNOWN',
          isActive: true,
          isPrimary: phoneNumbers.indexOf(phone) === 0
        },
        update: {
          phoneNumber: phone.display_phone_number,
          verifiedName: phone.verified_name,
          qualityRating: phone.quality_rating || 'UNKNOWN',
          isActive: true
        }
      });
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        organizationId,
        userId,
        action: 'META_CONNECTED',
        entity: 'MetaConnection',
        entityId: metaConnection.id,
        metadata: {
          wabaName: selectedWaba.name,
          wabaId: selectedWaba.id,
          phoneNumbers: phoneNumbers.map(p => p.display_phone_number),
          messagingTier: phoneNumbers[0]?.messaging_limit_tier
        }
      }
    });

    console.log('✅ Meta connection established for org:', organization.name);

    return {
      success: true,
      connection: {
        id: metaConnection.id,
        wabaName: selectedWaba.name,
        status: 'CONNECTED'
      },
      phoneNumbers: phoneNumbers.map(p => ({
        id: p.id,
        number: p.display_phone_number,
        verified: p.verified_name,
        quality: p.quality_rating
      }))
    };

  } catch (error: any) {
    console.error('OAuth callback error:', error);
    
    // Log failed attempt
    if (organizationId && userId) {
      await prisma.activityLog.create({
        data: {
          organizationId,
          userId,
          action: 'META_CONNECTION_FAILED',
          entity: 'MetaConnection',
          metadata: {
            error: error.message
          }
        }
      });
    }

    throw new Error(error.message || 'Failed to connect WhatsApp account');
  }
}