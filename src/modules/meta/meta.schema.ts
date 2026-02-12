// src/modules/meta/meta.schema.ts

import { z } from 'zod';

export const tokenExchangeSchema = z.object({
  body: z.object({
    code: z.string().min(1, 'Code is required'),
    organizationId: z.string().min(1, 'Organization ID is required'),
  }),
});

export const getOAuthUrlSchema = z.object({
  query: z.object({
    organizationId: z.string().optional(),
  }),
});

export type TokenExchangeBody = z.infer<typeof tokenExchangeSchema>['body'];
export type GetOAuthUrlQuery = z.infer<typeof getOAuthUrlSchema>['query'];