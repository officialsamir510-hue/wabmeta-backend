import { Server as SocketIOServer } from 'socket.io';
export declare class CampaignSocketService {
    private io;
    constructor(io: SocketIOServer);
    /**
     * Emit campaign status update to specific organization
     */
    emitCampaignUpdate(organizationId: string, campaignId: string, data: any): void;
    /**
     * Emit campaign progress update
     */
    emitCampaignProgress(organizationId: string, campaignId: string, progress: {
        sent: number;
        failed: number;
        total: number;
        percentage: number;
        status: string;
    }): void;
    /**
     * Emit campaign contact status update
     */
    emitContactStatus(organizationId: string, campaignId: string, contactUpdate: {
        contactId: string;
        phone: string;
        status: string;
        messageId?: string;
        error?: string;
    }): void;
    /**
     * Emit campaign completed event
     */
    emitCampaignCompleted(organizationId: string, campaignId: string, stats: {
        sentCount: number;
        failedCount: number;
        deliveredCount: number;
        readCount: number;
        totalRecipients: number;
    }): void;
    /**
     * Emit campaign error
     */
    emitCampaignError(organizationId: string, campaignId: string, error: {
        message: string;
        code?: string;
    }): void;
    /**
     * Emit CSV upload progress
     */
    emitCsvUploadProgress(userId: string, data: {
        uploadId: string;
        progress: number;
        totalRows: number;
        processedRows: number;
        validRows: number;
        invalidRows: number;
        duplicateRows: number;
        status: string;
    }): void;
    /**
     * Emit contact validation results
     */
    emitContactValidation(userId: string, data: {
        uploadId: string;
        contacts: any[];
    }): void;
    /**
     * Get active socket count for organization
     */
    getActiveConnections(organizationId: string): number;
}
export declare let campaignSocketService: CampaignSocketService;
export declare const initializeCampaignSocket: (io: SocketIOServer) => CampaignSocketService;
//# sourceMappingURL=campaigns.socket.d.ts.map