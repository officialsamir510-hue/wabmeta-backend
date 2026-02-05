// src/types/express.d.ts

import { Organization } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        organizationId?: string;
      };
      organization?: Organization;
    }
  }
}

export {};