// src/modules/campaigns/campaigns.socket.ts - COMPLETE

import { Server as SocketServer } from 'socket.io';

let io: SocketServer | null = null;

/**
 * Initialize campaign socket service with Socket.IO instance
 */
export const initializeCampaignSocket = (socketServer: SocketServer) => {
    io = socketServer;
    console.log('✅ Campaign Socket Service initialized');
};

/**
 * Campaign Socket Service Class
 */
class CampaignSocketService {
    /**
     * Emit campaign status update
     */
    emitCampaignUpdate(
        organizationId: string,
        campaignId: string,
        data: {
            status: string;
            message: string;
            totalContacts?: number;
        }
    ) {
        if (!io) {
            console.warn('⚠️ Socket.IO not initialized - cannot emit campaign:update');
            return;
        }

        const payload = {
            campaignId,
            organizationId,
            ...data,
            timestamp: new Date().toISOString(),
        };

        // Emit to multiple rooms for redundancy
        io.to(`org:${organizationId}`).emit('campaign:update', payload);
        io.to(`campaign:${campaignId}`).emit('campaign:update', payload);
        io.to(`org:${organizationId}:campaigns`).emit('campaign:update', payload);

        console.log(`📡 [SOCKET] campaign:update → org:${organizationId}`, {
            campaignId,
            status: data.status,
            message: data.message,
        });
    }

    /**
     * Emit campaign progress updates
     */
    emitCampaignProgress(
        organizationId: string,
        campaignId: string,
        data: {
            sent: number;
            failed: number;
            total: number;
            percentage: number;
            status: string;
        }
    ) {
        if (!io) {
            console.warn('⚠️ Socket.IO not initialized - cannot emit campaign:progress');
            return;
        }

        const payload = {
            campaignId,
            organizationId,
            ...data,
            timestamp: new Date().toISOString(),
        };

        io.to(`org:${organizationId}`).emit('campaign:progress', payload);
        io.to(`campaign:${campaignId}`).emit('campaign:progress', payload);
        io.to(`org:${organizationId}:campaigns`).emit('campaign:progress', payload);

        // Only log every 10% to reduce noise
        if (data.percentage % 10 === 0) {
            console.log(`📊 [SOCKET] campaign:progress → ${data.percentage}% (${data.sent}/${data.total})`);
        }
    }

    /**
     * Emit individual contact status update
     */
    emitContactStatus(
        organizationId: string,
        campaignId: string,
        data: {
            contactId: string;
            phone: string;
            status: string;
            messageId?: string;
            error?: string;
        }
    ) {
        if (!io) {
            console.warn('⚠️ Socket.IO not initialized - cannot emit campaign:contact');
            return;
        }

        const payload = {
            campaignId,
            organizationId,
            ...data,
            timestamp: new Date().toISOString(),
        };

        io.to(`org:${organizationId}`).emit('campaign:contact', payload);
        io.to(`campaign:${campaignId}`).emit('campaign:contact', payload);
        io.to(`campaign:${campaignId}`).emit('campaign:contact:status', payload);

        if (data.status === 'FAILED') {
            console.warn(`❌ [SOCKET] Contact failed: ${data.phone} - ${data.error || 'Unknown error'}`);
        }
    }

    /**
     * Emit campaign completion event
     */
    emitCampaignCompleted(
        organizationId: string,
        campaignId: string,
        stats: {
            sentCount: number;
            failedCount: number;
            deliveredCount: number;
            readCount: number;
            totalRecipients: number;
        }
    ) {
        if (!io) {
            console.warn('⚠️ Socket.IO not initialized - cannot emit campaign:completed');
            return;
        }

        const payload = {
            campaignId,
            organizationId,
            ...stats,
            timestamp: new Date().toISOString(),
        };

        io.to(`org:${organizationId}`).emit('campaign:completed', payload);
        io.to(`campaign:${campaignId}`).emit('campaign:completed', payload);
        io.to(`org:${organizationId}:campaigns`).emit('campaign:completed', payload);

        console.log(`🎉 [SOCKET] Campaign completed: ${campaignId}`, {
            sent: stats.sentCount,
            failed: stats.failedCount,
            total: stats.totalRecipients,
        });
    }

    /**
     * Check if socket is initialized
     */
    isInitialized(): boolean {
        return io !== null;
    }

    /**
     * Get Socket.IO instance (for advanced usage)
     */
    getIO(): SocketServer | null {
        return io;
    }
}

export const campaignSocketService = new CampaignSocketService();

export default campaignSocketService;