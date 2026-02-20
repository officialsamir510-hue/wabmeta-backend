import { MessageStatus } from '@prisma/client';
import { CreateCampaignInput, UpdateCampaignInput, CampaignsQueryInput, CampaignContactsQueryInput, CampaignResponse, CampaignDetailResponse, CampaignContactResponse, CampaignsListResponse, CampaignStats, CampaignAnalytics } from './campaigns.types';
export declare class CampaignsService {
    private findWhatsAppAccount;
    create(organizationId: string, userId: string, input: CreateCampaignInput): Promise<CampaignResponse>;
    getList(organizationId: string, query: CampaignsQueryInput): Promise<CampaignsListResponse>;
    getById(organizationId: string, campaignId: string): Promise<CampaignDetailResponse>;
    update(organizationId: string, campaignId: string, input: UpdateCampaignInput): Promise<CampaignResponse>;
    delete(organizationId: string, campaignId: string): Promise<{
        message: string;
    }>;
    start(organizationId: string, campaignId: string): Promise<CampaignResponse>;
    pause(organizationId: string, campaignId: string): Promise<CampaignResponse>;
    resume(organizationId: string, campaignId: string): Promise<CampaignResponse>;
    cancel(organizationId: string, campaignId: string): Promise<CampaignResponse>;
    getContacts(organizationId: string, campaignId: string, query: CampaignContactsQueryInput): Promise<{
        contacts: CampaignContactResponse[];
        meta: any;
    }>;
    retry(organizationId: string, campaignId: string, retryFailed?: boolean, retryPending?: boolean): Promise<{
        message: string;
        retryCount: number;
    }>;
    duplicate(organizationId: string, campaignId: string, newName: string): Promise<CampaignResponse>;
    private processCampaignSending;
    getStats(organizationId: string): Promise<CampaignStats>;
    getAnalytics(organizationId: string, campaignId: string): Promise<CampaignAnalytics>;
    updateContactStatus(organizationId: string, campaignId: string, contactId: string, status: MessageStatus, waMessageId?: string, failureReason?: string): Promise<void>;
    checkAndComplete(organizationId: string, campaignId: string): Promise<void>;
}
export declare const campaignsService: CampaignsService;
//# sourceMappingURL=campaigns.service.d.ts.map