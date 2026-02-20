// src/modules/campaigns/campaigns.socket.ts

import { Server as SocketIOServer } from 'socket.io';
import prisma from '../../config/database';

export class CampaignSocketService {
    private io: SocketIOServer;

    constructor(io: SocketIOServer) {
        this.io = io;
    }

    /**
     * Emit campaign status update to specific organization
     */
    emitCampaignUpdate(organizationId: string, campaignId: string, data: any) {
        this.io.to(`org:${organizationId}`).emit('campaign:update', {
            campaignId,
            ...data,
            timestamp: new Date().toISOString(),
        });

        console.log(`📢 Campaign update emitted to org:${organizationId}`, {
            campaignId,
            status: data.status,
        });
    }

    /**
     * Emit campaign progress update
     */
    emitCampaignProgress(organizationId: string, campaignId: string, progress: {
        sent: number;
        failed: number;
        total: number;
        percentage: number;
        status: string;
    }) {
        this.io.to(`org:${organizationId}`).emit('campaign:progress', {
            campaignId,
            ...progress,
            timestamp: new Date().toISOString(),
        });

        console.log(`📊 Campaign progress: ${progress.percentage}%`, {
            campaignId,
            sent: progress.sent,
            total: progress.total,
        });
    }

    /**
     * Emit campaign contact status update
     */
    emitContactStatus(organizationId: string, campaignId: string, contactUpdate: {
        contactId: string;
        phone: string;
        status: string;
        messageId?: string;
        error?: string;
    }) {
        this.io.to(`org:${organizationId}`).emit('campaign:contact:status', {
            campaignId,
            ...contactUpdate,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Emit campaign completed event
     */
    emitCampaignCompleted(organizationId: string, campaignId: string, stats: {
        sentCount: number;
        failedCount: number;
        deliveredCount: number;
        readCount: number;
        totalRecipients: number;
    }) {
        this.io.to(`org:${organizationId}`).emit('campaign:completed', {
            campaignId,
            ...stats,
            timestamp: new Date().toISOString(),
        });

        console.log(`✅ Campaign ${campaignId} completed`, stats);
    }

    /**
     * Emit campaign error
     */
    emitCampaignError(organizationId: string, campaignId: string, error: {
        message: string;
        code?: string;
    }) {
        this.io.to(`org:${organizationId}`).emit('campaign:error', {
            campaignId,
            ...error,
            timestamp: new Date().toISOString(),
        });

        console.error(`❌ Campaign ${campaignId} error:`, error.message);
    }

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
    }) {
        this.io.to(`user:${userId}`).emit('csv:upload:progress', {
            ...data,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Emit contact validation results
     */
    emitContactValidation(userId: string, data: {
        uploadId: string;
        contacts: any[];
    }) {
        this.io.to(`user:${userId}`).emit('csv:validation:batch', {
            ...data,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Get active socket count for organization
     */
    getActiveConnections(organizationId: string): number {
        const room = this.io.sockets.adapter.rooms.get(`org:${organizationId}`);
        return room ? room.size : 0;
    }
}

export let campaignSocketService: CampaignSocketService;

export const initializeCampaignSocket = (io: SocketIOServer) => {
    campaignSocketService = new CampaignSocketService(io);
    return campaignSocketService;
};