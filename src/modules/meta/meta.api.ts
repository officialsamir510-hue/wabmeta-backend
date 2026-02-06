// src/modules/meta/meta.api.ts

import axios, { AxiosInstance } from 'axios';
import config from '../../config';

interface MetaGraphResponse<T = any> {
  data?: T;
  error?: {
    message: string;
    type: string;
    code: number;
    fbtrace_id: string;
  };
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

interface PhoneNumberData {
  id: string;
  display_phone_number: string;
  verified_name: string;
  quality_rating: string;
  code_verification_status: string;
}

interface WABAData {
  id: string;
  name: string;
  timezone_id: string;
  message_template_namespace: string;
}

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
   * Exchange authorization code for access token
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
   * Get long-lived access token (60 days)
   */
  async getLongLivedToken(shortToken: string): Promise<TokenResponse> {
    try {
      const response = await this.client.get<TokenResponse>('/oauth/access_token', {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: config.meta.appId,
          client_secret: config.meta.appSecret,
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
   * Get user's WhatsApp Business Accounts
   */
  async getWhatsAppBusinessAccounts(userId: string): Promise<WABAData[]> {
    try {
      const response = await this.client.get<MetaGraphResponse<WABAData[]>>(
        `/${userId}/businesses`,
        {
          params: {
            fields: 'id,name,timezone_id,message_template_namespace'
          }
        }
      );

      if (response.data.error) {
        throw new Error(response.data.error.message);
      }

      return response.data.data || [];
    } catch (error: any) {
      console.error('Get WABA error:', error.response?.data || error.message);
      throw new Error('Failed to fetch WhatsApp Business Accounts');
    }
  }

  /**
   * Get phone numbers for a WABA
   */
  async getPhoneNumbers(wabaId: string): Promise<PhoneNumberData[]> {
    try {
      const response = await this.client.get<MetaGraphResponse<PhoneNumberData[]>>(
        `/${wabaId}/phone_numbers`,
        {
          params: {
            fields: 'id,display_phone_number,verified_name,quality_rating,code_verification_status'
          }
        }
      );

      if (response.data.error) {
        throw new Error(response.data.error.message);
      }

      return response.data.data || [];
    } catch (error: any) {
      console.error('Get phone numbers error:', error.response?.data || error.message);
      throw new Error('Failed to fetch phone numbers');
    }
  }

  /**
   * Send WhatsApp message
   */
  async sendMessage(phoneNumberId: string, to: string, message: any) {
    try {
      const response = await this.client.post(
        `/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: to,
          ...message
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Send message error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.error?.message || 'Failed to send message');
    }
  }

  /**
   * Send template message
   */
  async sendTemplateMessage(
    phoneNumberId: string,
    to: string,
    templateName: string,
    languageCode: string,
    components?: any[]
  ) {
    try {
      const message = {
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: languageCode
          },
          ...(components && { components })
        }
      };

      return await this.sendMessage(phoneNumberId, to, message);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to send template message');
    }
  }

  /**
   * Get message templates
   */
  async getMessageTemplates(wabaId: string) {
    try {
      const response = await this.client.get(`/${wabaId}/message_templates`, {
        params: {
          fields: 'name,status,category,language,components,id',
          limit: 100
        }
      });

      return response.data;
    } catch (error: any) {
      console.error('Get templates error:', error.response?.data || error.message);
      throw new Error('Failed to fetch templates');
    }
  }

  /**
   * Verify webhook signature
   */
  static verifyWebhookSignature(signature: string, payload: string): boolean {
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', config.meta.appSecret)
      .update(payload)
      .digest('hex');

    return signature === `sha256=${expectedSignature}`;
  }
}