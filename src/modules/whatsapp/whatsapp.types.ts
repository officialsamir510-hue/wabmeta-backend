// src/modules/whatsapp/whatsapp.types.ts

import { WhatsAppAccountStatus, MessageType, MessageDirection, MessageStatus } from '@prisma/client';

// ============================================
// META API TYPES
// ============================================

export interface MetaTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

export interface MetaBusinessAccount {
  id: string;
  name: string;
  timezone_id: string;
  message_template_namespace: string;
}

export interface MetaPhoneNumber {
  id: string;
  display_phone_number: string;
  verified_name: string;
  quality_rating: string;
  code_verification_status: string;
  platform_type: string;
}

export interface MetaMessageResponse {
  messaging_product: string;
  contacts: { input: string; wa_id: string }[];
  messages: { id: string }[];
}

export interface MetaTemplateResponse {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  components: MetaTemplateComponent[];
}

export interface MetaTemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: string;
  text?: string;
  buttons?: MetaButton[];
  example?: any;
}

export interface MetaButton {
  type: 'URL' | 'PHONE_NUMBER' | 'QUICK_REPLY';
  text: string;
  url?: string;
  phone_number?: string;
}

// ============================================
// WEBHOOK TYPES
// ============================================

export interface WebhookPayload {
  object: string;
  entry: WebhookEntry[];
}

export interface WebhookEntry {
  id: string;
  changes: WebhookChange[];
}

export interface WebhookChange {
  value: WebhookValue;
  field: string;
}

export interface WebhookValue {
  messaging_product: string;
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: WebhookContact[];
  messages?: WebhookMessage[];
  statuses?: WebhookStatus[];
  errors?: WebhookError[];
}

export interface WebhookContact {
  profile: { name: string };
  wa_id: string;
}

export interface WebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: WebhookMedia;
  video?: WebhookMedia;
  audio?: WebhookMedia;
  document?: WebhookMedia & { filename: string };
  sticker?: WebhookMedia;
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  contacts?: any[];
  button?: { text: string; payload: string };
  interactive?: {
    type: string;
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
  context?: {
    from: string;
    id: string;
  };
  errors?: WebhookError[];
}

export interface WebhookMedia {
  id: string;
  mime_type: string;
  sha256?: string;
  caption?: string;
}

export interface WebhookStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  conversation?: {
    id: string;
    origin: { type: string };
    expiration_timestamp?: string;
  };
  pricing?: {
    billable: boolean;
    pricing_model: string;
    category: string;
  };
  errors?: WebhookError[];
}

export interface WebhookError {
  code: number;
  title: string;
  message: string;
  error_data?: { details: string };
}

// ============================================
// REQUEST TYPES
// ============================================

export interface ConnectAccountInput {
  code: string;  // OAuth code from Meta
  redirectUri: string;
}

export interface SendMessageInput {
  to: string;  // Phone number with country code
  type: 'text' | 'template' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'interactive';
  // Text message
  text?: { body: string; preview_url?: boolean };
  // Template message
  template?: {
    name: string;
    language: { code: string };
    components?: TemplateComponent[];
  };
  // Media messages
  image?: { link?: string; id?: string; caption?: string };
  video?: { link?: string; id?: string; caption?: string };
  audio?: { link?: string; id?: string };
  document?: { link?: string; id?: string; caption?: string; filename?: string };
  // Location
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  // Interactive
  interactive?: InteractiveMessage;
  // Reply context
  context?: { message_id: string };
}

export interface TemplateComponent {
  type: 'header' | 'body' | 'button';
  sub_type?: 'quick_reply' | 'url';
  index?: number;
  parameters: TemplateParameter[];
}

export interface TemplateParameter {
  type: 'text' | 'currency' | 'date_time' | 'image' | 'video' | 'document';
  text?: string;
  currency?: { fallback_value: string; code: string; amount_1000: number };
  date_time?: { fallback_value: string };
  image?: { link: string };
  video?: { link: string };
  document?: { link: string; filename?: string };
}

export interface InteractiveMessage {
  type: 'button' | 'list' | 'product' | 'product_list';
  header?: {
    type: 'text' | 'image' | 'video' | 'document';
    text?: string;
    image?: { link: string };
    video?: { link: string };
    document?: { link: string };
  };
  body: { text: string };
  footer?: { text: string };
  action: InteractiveAction;
}

export interface InteractiveAction {
  button?: string;
  buttons?: { type: 'reply'; reply: { id: string; title: string } }[];
  sections?: { title?: string; rows: { id: string; title: string; description?: string }[] }[];
}

export interface SendTemplateInput {
  to: string;
  templateName: string;
  languageCode: string;
  components?: TemplateComponent[];
}

export interface UploadMediaInput {
  file: Buffer;
  mimeType: string;
  filename?: string;
}

// ============================================
// RESPONSE TYPES
// ============================================

export interface WhatsAppAccountResponse {
  id: string;
  phoneNumberId: string;
  wabaId: string;
  phoneNumber: string;
  displayName: string;
  qualityRating: string | null;
  status: WhatsAppAccountStatus;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SendMessageResponse {
  success: boolean;
  messageId?: string;
  waId?: string;
  error?: string;
}

export interface MediaUploadResponse {
  id: string;
}

export interface MediaUrlResponse {
  url: string;
  mime_type: string;
  sha256: string;
  file_size: number;
}

// ============================================
// INTERNAL TYPES
// ============================================

export interface ProcessedMessage {
  waMessageId: string;
  from: string;
  fromName: string;
  type: MessageType;
  content: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  mediaMimeType: string | null;
  timestamp: Date;
  replyToMessageId: string | null;
  metadata: any;
}