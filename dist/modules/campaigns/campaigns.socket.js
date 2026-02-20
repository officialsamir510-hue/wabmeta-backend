"use strict";
// src/modules/campaigns/campaigns.socket.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeCampaignSocket = exports.campaignSocketService = exports.CampaignSocketService = void 0;
class CampaignSocketService {
    io;
    constructor(io) {
        this.io = io;
    }
    /**
     * Emit campaign status update to specific organization
     */
    emitCampaignUpdate(organizationId, campaignId, data) {
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
    emitCampaignProgress(organizationId, campaignId, progress) {
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
    emitContactStatus(organizationId, campaignId, contactUpdate) {
        this.io.to(`org:${organizationId}`).emit('campaign:contact:status', {
            campaignId,
            ...contactUpdate,
            timestamp: new Date().toISOString(),
        });
    }
    /**
     * Emit campaign completed event
     */
    emitCampaignCompleted(organizationId, campaignId, stats) {
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
    emitCampaignError(organizationId, campaignId, error) {
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
    emitCsvUploadProgress(userId, data) {
        this.io.to(`user:${userId}`).emit('csv:upload:progress', {
            ...data,
            timestamp: new Date().toISOString(),
        });
    }
    /**
     * Emit contact validation results
     */
    emitContactValidation(userId, data) {
        this.io.to(`user:${userId}`).emit('csv:validation:batch', {
            ...data,
            timestamp: new Date().toISOString(),
        });
    }
    /**
     * Get active socket count for organization
     */
    getActiveConnections(organizationId) {
        const room = this.io.sockets.adapter.rooms.get(`org:${organizationId}`);
        return room ? room.size : 0;
    }
}
exports.CampaignSocketService = CampaignSocketService;
const initializeCampaignSocket = (io) => {
    exports.campaignSocketService = new CampaignSocketService(io);
    return exports.campaignSocketService;
};
exports.initializeCampaignSocket = initializeCampaignSocket;
//# sourceMappingURL=campaigns.socket.js.map