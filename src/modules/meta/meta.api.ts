// src/modules/meta/meta.api.ts

import axios, { AxiosInstance } from 'axios';

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

interface EmbeddedSignupData {
  waba_id?: string;
  phone_number_id?: string;
}

export class MetaGraphAPI {
  private client: AxiosInstance;
  private version: string;
  registerPhoneNumber: any;
  sendTextMessage: any;

  constructor(accessToken?: string) {
    this.version = process.env.META_GRAPH_API_VERSION || 'v21.0';

    this.client = axios.create({
      baseURL: `https://graph.facebook.com/${this.version}`,
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken && { 'Authorization': `Bearer ${accessToken}` })
      }
    });
  }

  /**
   * Exchange code for token
   */
  async exchangeCodeForToken(code: string): Promise<TokenResponse> {
    try {
      const response = await this.client.get<TokenResponse>('/oauth/access_token', {
        params: {
          client_id: process.env.META_APP_ID,
          client_secret: process.env.META_APP_SECRET,
          code: code,
          redirect_uri: process.env.META_REDIRECT_URI
        }
      });

      return response.data;
    } catch (error: any) {
      console.error('Token exchange error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.error?.message || 'Failed to exchange code for token');
    }
  }

  /**
   * Get long-lived token (60 days)
   */
  async getLongLivedToken(shortToken: string): Promise<TokenResponse> {
    try {
      const response = await this.client.get<TokenResponse>('/oauth/access_token', {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: process.env.META_APP_ID,
          client_secret: process.env.META_APP_SECRET,
          fb_exchange_token: shortToken
        }
      });

      return response.data;
    } catch (error: any) {
      console.error('Long-lived token error:', error.response?.data || error.message);
      throw new Error('Failed to get long-lived token');
    }
  }

  /**
   * Debug token to get embedded signup data
   */
  async getTokenInfo(accessToken: string): Promise<any> {
    try {
      const response = await this.client.get('/debug_token', {
        params: {
          input_token: accessToken,
          access_token: `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`
        }
      });

      return response.data.data;
    } catch (error: any) {
      console.error('Debug token error:', error.response?.data || error.message);
      throw new Error('Failed to debug token');
    }
  }

  /**
   * Get WABA details by ID
   */
  async getWABAById(wabaId: string, accessToken: string) {
    try {
      const response = await this.client.get(`/${wabaId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        params: {
          fields: 'id,name,timezone_id,message_template_namespace,owner_business_info,account_review_status'
        }
      });

      return response.data;
    } catch (error: any) {
      console.error('Get WABA by ID error:', error.response?.data || error.message);
      throw new Error('Failed to fetch WhatsApp Business Account details');
    }
  }

  /**
   * Get accessible WABAs - Multiple methods with Embedded Signup priority
   */
  async getAccessibleWABAs(userAccessToken: string, embeddedSignupWabaId?: string) {
    try {
      console.log('🔍 Fetching accessible WABAs...');

      // Method 1: If WABA ID provided from Embedded Signup, use it directly
      if (embeddedSignupWabaId) {
        console.log('📌 Using Embedded Signup WABA ID:', embeddedSignupWabaId);
        try {
          const waba = await this.getWABAById(embeddedSignupWabaId, userAccessToken);
          if (waba) {
            console.log('✅ Found WABA via Embedded Signup:', waba.name);
            return [waba];
          }
        } catch (wabaError: any) {
          console.error('Failed to get WABA by ID:', wabaError.message);
        }
      }

      // Method 2: Try debug token to get WABA info (Embedded Signup stores it here)
      try {
        const tokenInfo = await this.getTokenInfo(userAccessToken);
        console.log('Token granular_scopes:', JSON.stringify(tokenInfo.granular_scopes, null, 2));

        // Look for WABA ID in granular scopes
        if (tokenInfo.granular_scopes) {
          for (const scope of tokenInfo.granular_scopes) {
            if (scope.scope === 'whatsapp_business_management' && scope.target_ids?.length > 0) {
              const wabaId = scope.target_ids[0];
              console.log('📌 Found WABA ID in granular_scopes:', wabaId);
              
              try {
                const waba = await this.getWABAById(wabaId, userAccessToken);
                if (waba) {
                  console.log('✅ Found WABA from granular_scopes:', waba.name);
                  return [waba];
                }
              } catch (err) {
                console.error('Failed to fetch WABA from granular scope:', err);
              }
            }

            // Also check for phone number IDs
            if (scope.scope === 'whatsapp_business_messaging' && scope.target_ids?.length > 0) {
              console.log('📞 Found Phone Number IDs:', scope.target_ids);
              // We can use phone number to find WABA
              for (const phoneId of scope.target_ids) {
                try {
                  const phoneResponse = await this.client.get(`/${phoneId}`, {
                    headers: { 'Authorization': `Bearer ${userAccessToken}` },
                    params: { fields: 'id,display_phone_number,verified_name,account_id' }
                  });

                  const wabaId = phoneResponse.data.account_id;
                  if (wabaId) {
                    console.log('📌 Found WABA ID via phone number:', wabaId);
                    const waba = await this.getWABAById(wabaId, userAccessToken);
                    if (waba) {
                      console.log('✅ Found WABA via phone number:', waba.name);
                      return [waba];
                    }
                  }
                } catch (phoneErr) {
                  console.error('Failed to get phone number info:', phoneErr);
                }
              }
            }
          }
        }
      } catch (tokenError: any) {
        console.error('Token debug error:', tokenError.message);
      }

      // Method 3: Try direct WABA access
      try {
        const directResponse = await this.client.get('/me/owned_whatsapp_business_accounts', {
          headers: { 'Authorization': `Bearer ${userAccessToken}` },
          params: { fields: 'id,name,timezone_id,message_template_namespace' }
        });

        if (directResponse.data?.data?.length > 0) {
          console.log(`✅ Found ${directResponse.data.data.length} WABAs via direct access`);
          return directResponse.data.data;
        }
      } catch (directError: any) {
        console.log('Direct WABA access failed:', directError.response?.data?.error?.message);
      }

      // Method 4: Last resort - try businesses (needs business_management permission)
      try {
        const tokenInfo = await this.getTokenInfo(userAccessToken);
        const userId = tokenInfo.user_id;

        const businessResponse = await this.client.get(`/${userId}/businesses`, {
          headers: { 'Authorization': `Bearer ${userAccessToken}` },
          params: { fields: 'id,name' }
        });

        const businesses = businessResponse.data?.data || [];
        console.log(`Found ${businesses.length} businesses`);

        const wabas: any[] = [];
        for (const business of businesses) {
          try {
            const wabaResponse = await this.client.get(`/${business.id}/owned_whatsapp_business_accounts`, {
              headers: { 'Authorization': `Bearer ${userAccessToken}` },
              params: { fields: 'id,name,timezone_id,message_template_namespace' }
            });

            if (wabaResponse.data?.data) {
              wabas.push(...wabaResponse.data.data);
            }
          } catch (err) {
            console.log(`No WABAs found for business ${business.name}`);
          }
        }

        if (wabas.length > 0) {
          return wabas;
        }
      } catch (businessError: any) {
        console.log('Business access failed (might need advanced access):', 
          businessError.response?.data?.error?.message);
      }

      // Final error
      throw new Error(
        'Could not find WhatsApp Business Account. Please ensure:\n' +
        '1. You selected a WhatsApp Business Account during signup\n' +
        '2. You have admin access to the account\n' +
        '3. Try disconnecting and reconnecting'
      );

    } catch (error: any) {
      console.error('Get WABAs final error:', error.message);
      throw new Error(error.message || 'Failed to fetch WhatsApp Business Accounts');
    }
  }

  /**
   * Get phone numbers for WABA
   */
  async getPhoneNumbers(wabaId: string, accessToken: string) {
    try {
      const response = await this.client.get(`/${wabaId}/phone_numbers`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        params: {
          fields: 'id,display_phone_number,verified_name,quality_rating,code_verification_status,messaging_limit_tier,name_status'
        }
      });

      return response.data?.data || [];
    } catch (error: any) {
      console.error('Get phone numbers error:', error.response?.data || error.message);
      throw new Error('Failed to fetch phone numbers');
    }
  }

  /**
   * Send message
   */
  async sendMessage(phoneNumberId: string, accessToken: string, payload: any) {
    try {
      const response = await this.client.post(
        `/${phoneNumberId}/messages`,
        { messaging_product: 'whatsapp', ...payload },
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      return response.data;
    } catch (error: any) {
      console.error('Send message error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.error?.message || 'Failed to send message');
    }
  }
}