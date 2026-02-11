// src/modules/meta/meta.schema.ts

import { z } from 'zod';

export const tokenExchangeSchema = z.object({
  body: z.object({
    code: z.string().min(1, 'Authorization code is required'),
    organizationId: z.string().min(1, 'Organization ID is required'),
  }),
});

export const disconnectAccountSchema = z.object({
  params: z.object({
    accountId: z.string().min(1, 'Account ID is required'),
  }),
});

export const refreshTokenSchema = z.object({
  params: z.object({
    accountId: z.string().min(1, 'Account ID is required'),
  }),
});

export const webhookVerifySchema = z.object({
  query: z.object({
    'hub.mode': z.string(),
    'hub.verify_token': z.string(),
    'hub.challenge': z.string(),
  }),
});

export type TokenExchangeInput = z.infer<typeof tokenExchangeSchema>;
export type DisconnectAccountInput = z.infer<typeof disconnectAccountSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type WebhookVerifyInput = z.infer<typeof webhookVerifySchema>;