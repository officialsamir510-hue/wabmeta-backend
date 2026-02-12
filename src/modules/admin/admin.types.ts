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

export interface CreatePlanInput {
  name: string;
  slug?: string;
  type: string;
  description?: string;
  monthlyPrice: number;
  yearlyPrice: number;
  maxWhatsAppAccounts?: number;
  maxContacts?: number;
  maxMessages?: number;
  maxMessagesPerMonth?: number;
  maxCampaigns?: number;
  maxCampaignsPerMonth?: number;
  maxTeamMembers?: number;
  maxTemplates?: number;
  maxChatbots?: number;
  maxAutomations?: number;
  maxApiCalls?: number;
  features?: string[];
  isActive?: boolean;
}