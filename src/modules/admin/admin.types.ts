// src/modules/admin/admin.types.ts

export interface ActivityLogResponse {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  userId: string | null;
  userEmail: string;
  organizationId: string | null;
  organizationName: string;
  metadata: any;
  ipAddress: string | null;
  createdAt: Date;
}