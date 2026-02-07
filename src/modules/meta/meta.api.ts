// src/modules/meta/meta.api.ts

import axios, { AxiosInstance } from 'axios';

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

export class MetaGraphAPI {
  private client: AxiosInstance;
  private version: string;

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
   * Get accessible WABAs for user (IMPROVED VERSION)
   */
  async getAccessibleWABAs(userAccessToken: string) {
    try {
      console.log('🔍 Fetching accessible WABAs...');

      // Method 1: Try direct WABA access FIRST (most common for Embedded Signup)
      try {
        const directResponse = await this.client.get('/me/owned_whatsapp_business_accounts', {
          headers: {
            'Authorization': `Bearer ${userAccessToken}`
          },
          params: {
            fields: 'id,name,timezone_id,message_template_namespace,owner_business_info'
          }
        });

        if (directResponse.data?.data && directResponse.data.data.length > 0) {
          console.log(`✅ Found ${directResponse.data.data.length} WABAs via direct access`);
          return directResponse.data.data;
        }
      } catch (directError: any) {
        console.log('Direct WABA access failed:', directError.response?.data?.error?.message || 'Unknown error');
      }

      // Method 2: Try shared WABAs
      try {
        const sharedResponse = await this.client.get('/me/client_whatsapp_business_accounts', {
          headers: {
            'Authorization': `Bearer ${userAccessToken}`
          },
          params: {
            fields: 'id,name,timezone_id,message_template_namespace'
          }
        });

        if (sharedResponse.data?.data && sharedResponse.data.data.length > 0) {
          console.log(`✅ Found ${sharedResponse.data.data.length} shared WABAs`);
          return sharedResponse.data.data;
        }
      } catch (sharedError: any) {
        console.log('Shared WABA access failed:', sharedError.response?.data?.error?.message || 'Unknown error');
      }

      // Method 3: Try via businesses
      try {
        // Debug token to get user ID
        const debugResponse = await this.client.get('/debug_token', {
          params: {
            input_token: userAccessToken,
            access_token: `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`
          }
        });

        const userId = debugResponse.data.data.user_id;
        console.log('User ID:', userId);

        // Check permissions
        const permissionsResponse = await this.client.get(`/${userId}/permissions`, {
          headers: {
            'Authorization': `Bearer ${userAccessToken}`
          }
        });

        console.log('User permissions:', permissionsResponse.data);

        // Get businesses
        const businessResponse = await this.client.get(`/${userId}/businesses`, {
          headers: {
            'Authorization': `Bearer ${userAccessToken}`
          },
          params: {
            fields: 'id,name,verification_status'
          }
        });

        const businesses = businessResponse.data?.data || [];
        console.log(`Found ${businesses.length} businesses`);

        if (businesses.length === 0) {
          // User might need to create business account first
          throw new Error('No Meta Business Account found. Please create a business account at business.facebook.com first.');
        }

        const wabas: any[] = [];

        // Get WABAs for each business
        for (const business of businesses) {
          try {
            const wabaResponse = await this.client.get(`/${business.id}/owned_whatsapp_business_accounts`, {
              headers: {
                'Authorization': `Bearer ${userAccessToken}`
              },
              params: {
                fields: 'id,name,timezone_id,message_template_namespace,owner_business_info'
              }
            });

            if (wabaResponse.data?.data && wabaResponse.data.data.length > 0) {
              console.log(`✅ Found ${wabaResponse.data.data.length} WABAs for business "${business.name}"`);
              wabas.push(...wabaResponse.data.data);
            }
          } catch (businessError: any) {
            console.error(`Failed to fetch WABAs for business ${business.id}:`, 
              businessError.response?.data?.error?.message || 'Unknown error');
          }

          // Also try client WABAs for each business
          try {
            const clientWabaResponse = await this.client.get(`/${business.id}/client_whatsapp_business_accounts`, {
              headers: {
                'Authorization': `Bearer ${userAccessToken}`
              },
              params: {
                fields: 'id,name,timezone_id,message_template_namespace'
              }
            });

            if (clientWabaResponse.data?.data && clientWabaResponse.data.data.length > 0) {
              console.log(`✅ Found ${clientWabaResponse.data.data.length} client WABAs for business "${business.name}"`);
              wabas.push(...clientWabaResponse.data.data);
            }
          } catch (clientError: any) {
            console.error(`Failed to fetch client WABAs for business ${business.id}:`, 
              clientError.response?.data?.error?.message || 'Unknown error');
          }
        }

        if (wabas.length > 0) {
          return wabas;
        }

      } catch (businessError: any) {
        console.error('Business access error:', businessError.response?.data || businessError.message);
      }

      // If all methods fail, provide helpful error message
      throw new Error(
        'No WhatsApp Business Accounts found. Please ensure:\n' +
        '1. You have a Meta Business Account (create at business.facebook.com)\n' +
        '2. WhatsApp Business Account is created and verified\n' +
        '3. You have admin access to the WhatsApp Business Account\n' +
        '4. The app has necessary permissions (whatsapp_business_management)\n\n' +
        'If you just created a WABA, it may take a few minutes to appear.'
      );

    } catch (error: any) {
      console.error('Get WABAs final error:', error.response?.data || error.message);
      throw new Error(error.message || 'Failed to fetch WhatsApp Business Accounts');
    }
  }

  /**
   * Get phone numbers for WABA
   */
  async getPhoneNumbers(wabaId: string, accessToken: string) {
    try {
      const response = await this.client.get(`/${wabaId}/phone_numbers`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        params: {
          fields: 'id,display_phone_number,verified_name,quality_rating,code_verification_status,messaging_limit_tier,name_status'
        }
      });

      return response.data?.data || [];
    } catch (error: any) {
      console.error('Get phone numbers error:', error.response?.data || error.message);
      throw new Error('Failed to fetch phone numbers. Please ensure a phone number is added to your WhatsApp Business Account.');
    }
  }

  /**
   * Send message
   */
  async sendMessage(phoneNumberId: string, accessToken: string, payload: any) {
    try {
      const response = await this.client.post(
        `/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          ...payload
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Send message error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.error?.message || 'Failed to send message');
    }
  }
}