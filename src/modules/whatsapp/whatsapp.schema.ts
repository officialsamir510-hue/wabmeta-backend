// src/modules/whatsapp/whatsapp.schema.ts

import { z } from 'zod';

// ============================================
// REQUEST SCHEMAS
// ============================================

export const connectAccountSchema = z.object({
  body: z.object({
    code: z.string().min(1, 'OAuth code is required'),
    redirectUri: z.string().url('Invalid redirect URI'),
  }),
});

export const disconnectAccountSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Account ID is required'),
  }),
});

export const setDefaultAccountSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Account ID is required'),
  }),
});

export const sendTextMessageSchema = z.object({
  body: z.object({
    whatsappAccountId: z.string().min(1, 'WhatsApp account ID is required'),
    to: z.string().regex(/^\+?[1-9]\d{10,14}$/, 'Invalid phone number'),
    text: z.string().min(1, 'Message text is required').max(4096, 'Message too long'),
    replyToMessageId: z.string().optional(),
  }),
});

export const sendTemplateMessageSchema = z.object({
  body: z.object({
    whatsappAccountId: z.string().min(1, 'WhatsApp account ID is required'),
    to: z.string().regex(/^\+?[1-9]\d{10,14}$/, 'Invalid phone number'),
    templateName: z.string().min(1, 'Template name is required'),
    languageCode: z.string().min(2).max(10).default('en'),
    components: z.array(z.object({
      type: z.enum(['header', 'body', 'button']),
      sub_type: z.enum(['quick_reply', 'url']).optional(),
      index: z.number().optional(),
      parameters: z.array(z.object({
        type: z.enum(['text', 'currency', 'date_time', 'image', 'video', 'document']),
        text: z.string().optional(),
        image: z.object({ link: z.string().url() }).optional(),
        video: z.object({ link: z.string().url() }).optional(),
        document: z.object({ link: z.string().url(), filename: z.string().optional() }).optional(),
      })),
    })).optional(),
  }),
});

export const sendMediaMessageSchema = z.object({
  body: z.object({
    whatsappAccountId: z.string().min(1, 'WhatsApp account ID is required'),
    to: z.string().regex(/^\+?[1-9]\d{10,14}$/, 'Invalid phone number'),
    type: z.enum(['image', 'video', 'audio', 'document']),
    mediaUrl: z.string().url('Invalid media URL'),
    caption: z.string().max(1024).optional(),
    filename: z.string().optional(),
  }),
});

export const sendInteractiveMessageSchema = z.object({
  body: z.object({
    whatsappAccountId: z.string().min(1, 'WhatsApp account ID is required'),
    to: z.string().regex(/^\+?[1-9]\d{10,14}$/, 'Invalid phone number'),
    interactiveType: z.enum(['button', 'list']),
    bodyText: z.string().min(1).max(1024),
    headerText: z.string().max(60).optional(),
    footerText: z.string().max(60).optional(),
    buttons: z.array(z.object({
      id: z.string().max(256),
      title: z.string().max(20),
    })).max(3).optional(),
    sections: z.array(z.object({
      title: z.string().max(24).optional(),
      rows: z.array(z.object({
        id: z.string().max(200),
        title: z.string().max(24),
        description: z.string().max(72).optional(),
      })).max(10),
    })).max(10).optional(),
  }),
});

export const webhookVerifySchema = z.object({
  query: z.object({
    'hub.mode': z.string(),
    'hub.verify_token': z.string(),
    'hub.challenge': z.string(),
  }),
});

export const getMediaUrlSchema = z.object({
  params: z.object({
    mediaId: z.string().min(1, 'Media ID is required'),
  }),
  query: z.object({
    whatsappAccountId: z.string().min(1, 'WhatsApp account ID is required'),
  }),
});

export const syncTemplatesSchema = z.object({
  body: z.object({
    whatsappAccountId: z.string().min(1, 'WhatsApp account ID is required'),
  }),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type ConnectAccountSchema = z.infer<typeof connectAccountSchema>;
export type SendTextMessageSchema = z.infer<typeof sendTextMessageSchema>;
export type SendTemplateMessageSchema = z.infer<typeof sendTemplateMessageSchema>;
export type SendMediaMessageSchema = z.infer<typeof sendMediaMessageSchema>;
export type SendInteractiveMessageSchema = z.infer<typeof sendInteractiveMessageSchema>;