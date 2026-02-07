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
   * Get accessible WABAs for user
   */
  async getAccessibleWABAs(userAccessToken: string) {
    try {
      // Debug token to get user ID
      const debugResponse = await this.client.get('/debug_token', {
        params: {
          input_token: userAccessToken,
          access_token: `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`
        }
      });

      const userId = debugResponse.data.data.user_id;

      // Get businesses
      const businessResponse = await this.client.get(`/${userId}/businesses`, {
        headers: {
          'Authorization': `Bearer ${userAccessToken}`
        },
        params: {
          fields: 'id,name'
        }
      });

      const businesses = businessResponse.data.data || [];
      const wabas: any[] = [];

      // Get WABAs for each business
      for (const business of businesses) {
        try {
          const wabaResponse = await this.client.get(`/${business.id}/owned_whatsapp_business_accounts`, {
            headers: {
              'Authorization': `Bearer ${userAccessToken}`
            },
            params: {
              fields: 'id,name,timezone_id,message_template_namespace'
            }
          });

          if (wabaResponse.data.data) {
            wabas.push(...wabaResponse.data.data);
          }
        } catch (err) {
          console.error(`Error fetching WABAs for business ${business.id}`);
        }
      }

      // If no WABAs from businesses, try direct WABA access
      if (wabas.length === 0) {
        try {
          const directWabaResponse = await this.client.get('/me/whatsapp_business_accounts', {
            headers: {
              'Authorization': `Bearer ${userAccessToken}`
            },
            params: {
              fields: 'id,name'
            }
          });

          if (directWabaResponse.data.data) {
            wabas.push(...directWabaResponse.data.data);
          }
        } catch (err) {
          console.error('Error fetching direct WABAs');
        }
      }

      return wabas;
    } catch (error: any) {
      console.error('Get WABAs error:', error.response?.data || error.message);
      throw new Error('Failed to fetch WhatsApp Business Accounts');
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
          fields: 'id,display_phone_number,verified_name,quality_rating,code_verification_status,messaging_limit_tier'
        }
      });

      return response.data.data || [];
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