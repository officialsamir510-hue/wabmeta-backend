// src/modules/meta/meta.types.ts

export interface MetaConfig {
  appId: string;
  appSecret: string;
  configId: string;  // Embedded Signup Config ID
  graphApiVersion: string;
  webhookVerifyToken: string;
}

export interface TokenExchangeRequest {
  code: string;
  organizationId: string;
}

export interface TokenExchangeResponse {
  accessToken: string;
  tokenType: string;
  expiresIn?: number;
}

export interface WABAInfo {
  wabaId: string;
  name: string;
  timezone: string;
  messageTemplateNamespace: string;
  ownerBusinessId: string;
  phoneNumbers: PhoneNumberInfo[];
}

export interface PhoneNumberInfo {
  id: string;
  verifiedName: string;
  displayPhoneNumber: string;
  qualityRating: string;
  codeVerificationStatus?: string;
  platformType?: string;
  throughput?: {
    level: string;
  };
}

export interface EmbeddedSignupResponse {
  accessToken: string;
  dataAccessExpirationTime: number;
  expiresIn: number;
  longLivedToken?: string;
}

export interface DebugTokenResponse {
  data: {
    app_id: string;
    type: string;
    application: string;
    data_access_expires_at: number;
    expires_at: number;
    is_valid: boolean;
    scopes: string[];
    granular_scopes: Array<{
      scope: string;
      target_ids?: string[];
    }>;
    user_id: string;
  };
}

export interface SharedWABAInfo {
  id: string;
  name: string;
  currency: string;
  timezone_id: string;
  message_template_namespace: string;
  owner_business_info: {
    id: string;
    name: string;
  };
  on_behalf_of_business_info?: {
    id: string;
    name: string;
  };
}

export interface SubscribedApps {
  data: Array<{
    whatsapp_business_api_data: {
      id: string;
      link: string;
      name: string;
    };
  }>;
}

export interface WebhookSubscribeResponse {
  success: boolean;
}

export interface ConnectionProgress {
  step: 'TOKEN_EXCHANGE' | 'FETCHING_WABA' | 'FETCHING_PHONE' | 'SUBSCRIBE_WEBHOOK' | 'SAVING' | 'COMPLETED';
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  message: string;
  data?: any;
}

export interface MetaApiError {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id: string;
  };
}