// src/modules/meta/meta.api.ts

import axios, { AxiosInstance } from 'axios';
import config from '../../config';

export class MetaGraphAPI {
  private client: AxiosInstance;
  private version: string;

  constructor(accessToken?: string) {
    this.version = config.meta.graphApiVersion || 'v21.0';
    
    this.client = axios.create({
      baseURL: `https://graph.facebook.com/${this.version}`,
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken && { 'Authorization': `Bearer ${accessToken}` })
      }
    });
  }

  /**
   * Exchange code for token (OAuth flow)
   */
  async exchangeCodeForToken(code: string): Promise<TokenResponse> {
    try {
      const response = await this.client.get<TokenResponse>('/oauth/access_token', {
        params: {
          client_id: config.meta.appId,
          client_secret: config.meta.appSecret,
          code: code,
          redirect_uri: config.meta.redirectUri
        }
      });

      return response.data;
    } catch (error: any) {
      console.error('Token exchange error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.error?.message || 'Failed to exchange code for token');
    }
  }

  /**
   * Get user's accessible WhatsApp Business Accounts
   * This will return the WABAs the user who authorized has access to
   */
  async getAccessibleWABAs(userAccessToken: string) {
    try {
      // First, get the user ID from token
      const debugResponse = await this.client.get('/debug_token', {
        params: {
          input_token: userAccessToken,
          access_token: `${config.meta.appId}|${config.meta.appSecret}`
        }
      });

      const userId = debugResponse.data.data.user_id;

      // Get WABAs accessible to this user
      const response = await this.client.get(`/${userId}/accounts`, {
        headers: {
          'Authorization': `Bearer ${userAccessToken}`
        },
        params: {
          fields: 'id,name,timezone_id,message_template_namespace'
        }
      });

      // For each account, get WhatsApp Business Accounts
      const accounts = response.data.data || [];
      const wabas = [];

      for (const account of accounts) {
        try {
          const wabaResponse = await this.client.get(`/${account.id}/owned_whatsapp_business_accounts`, {
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
        } catch (error) {
          console.error(`Error fetching WABAs for account ${account.id}:`, error);
        }
      }

      return wabas;
    } catch (error: any) {
      console.error('Get WABAs error:', error.response?.data || error.message);
      throw new Error('Failed to fetch WhatsApp Business Accounts');
    }
  }

  /**
   * Get phone numbers for a WABA
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
}