"use strict";
// src/modules/whatsapp/whatsapp.schema.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncTemplatesSchema = exports.getMediaUrlSchema = exports.webhookVerifySchema = exports.sendInteractiveMessageSchema = exports.sendMediaMessageSchema = exports.sendTemplateMessageSchema = exports.sendTextMessageSchema = exports.setDefaultAccountSchema = exports.disconnectAccountSchema = exports.connectAccountSchema = void 0;
const zod_1 = require("zod");
// ============================================
// REQUEST SCHEMAS
// ============================================
exports.connectAccountSchema = zod_1.z.object({
    body: zod_1.z.object({
        code: zod_1.z.string().min(1, 'OAuth code is required'),
        redirectUri: zod_1.z.string().url('Invalid redirect URI'),
    }),
});
exports.disconnectAccountSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Account ID is required'),
    }),
});
exports.setDefaultAccountSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().min(1, 'Account ID is required'),
    }),
});
exports.sendTextMessageSchema = zod_1.z.object({
    body: zod_1.z.object({
        whatsappAccountId: zod_1.z.string().min(1, 'WhatsApp account ID is required'),
        to: zod_1.z.string().regex(/^\+?[1-9]\d{10,14}$/, 'Invalid phone number'),
        text: zod_1.z.string().min(1, 'Message text is required').max(4096, 'Message too long'),
        replyToMessageId: zod_1.z.string().optional(),
    }),
});
exports.sendTemplateMessageSchema = zod_1.z.object({
    body: zod_1.z.object({
        whatsappAccountId: zod_1.z.string().min(1, 'WhatsApp account ID is required'),
        to: zod_1.z.string().regex(/^\+?[1-9]\d{10,14}$/, 'Invalid phone number'),
        templateName: zod_1.z.string().min(1, 'Template name is required'),
        languageCode: zod_1.z.string().min(2).max(10).default('en'),
        components: zod_1.z.array(zod_1.z.object({
            type: zod_1.z.enum(['header', 'body', 'button']),
            sub_type: zod_1.z.enum(['quick_reply', 'url']).optional(),
            index: zod_1.z.number().optional(),
            parameters: zod_1.z.array(zod_1.z.object({
                type: zod_1.z.enum(['text', 'currency', 'date_time', 'image', 'video', 'document']),
                text: zod_1.z.string().optional(),
                image: zod_1.z.object({ link: zod_1.z.string().url() }).optional(),
                video: zod_1.z.object({ link: zod_1.z.string().url() }).optional(),
                document: zod_1.z.object({ link: zod_1.z.string().url(), filename: zod_1.z.string().optional() }).optional(),
            })),
        })).optional(),
    }),
});
exports.sendMediaMessageSchema = zod_1.z.object({
    body: zod_1.z.object({
        whatsappAccountId: zod_1.z.string().min(1, 'WhatsApp account ID is required'),
        to: zod_1.z.string().regex(/^\+?[1-9]\d{10,14}$/, 'Invalid phone number'),
        type: zod_1.z.enum(['image', 'video', 'audio', 'document']),
        mediaUrl: zod_1.z.string().url('Invalid media URL'),
        caption: zod_1.z.string().max(1024).optional(),
        filename: zod_1.z.string().optional(),
    }),
});
exports.sendInteractiveMessageSchema = zod_1.z.object({
    body: zod_1.z.object({
        whatsappAccountId: zod_1.z.string().min(1, 'WhatsApp account ID is required'),
        to: zod_1.z.string().regex(/^\+?[1-9]\d{10,14}$/, 'Invalid phone number'),
        interactiveType: zod_1.z.enum(['button', 'list']),
        bodyText: zod_1.z.string().min(1).max(1024),
        headerText: zod_1.z.string().max(60).optional(),
        footerText: zod_1.z.string().max(60).optional(),
        buttons: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string().max(256),
            title: zod_1.z.string().max(20),
        })).max(3).optional(),
        sections: zod_1.z.array(zod_1.z.object({
            title: zod_1.z.string().max(24).optional(),
            rows: zod_1.z.array(zod_1.z.object({
                id: zod_1.z.string().max(200),
                title: zod_1.z.string().max(24),
                description: zod_1.z.string().max(72).optional(),
            })).max(10),
        })).max(10).optional(),
    }),
});
exports.webhookVerifySchema = zod_1.z.object({
    query: zod_1.z.object({
        'hub.mode': zod_1.z.string(),
        'hub.verify_token': zod_1.z.string(),
        'hub.challenge': zod_1.z.string(),
    }),
});
exports.getMediaUrlSchema = zod_1.z.object({
    params: zod_1.z.object({
        mediaId: zod_1.z.string().min(1, 'Media ID is required'),
    }),
    query: zod_1.z.object({
        whatsappAccountId: zod_1.z.string().min(1, 'WhatsApp account ID is required'),
    }),
});
exports.syncTemplatesSchema = zod_1.z.object({
    body: zod_1.z.object({
        whatsappAccountId: zod_1.z.string().min(1, 'WhatsApp account ID is required'),
    }),
});
//# sourceMappingURL=whatsapp.schema.js.map