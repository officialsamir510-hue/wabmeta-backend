"use strict";
// 📁 src/socket.ts - COMPLETE WITH CAMPAIGN SOCKET INTEGRATION
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCampaignConnections = exports.getOrganizationConnections = exports.getActiveConnections = exports.broadcastToCampaign = exports.broadcastToConversation = exports.broadcastToUser = exports.broadcastToOrganization = exports.getIO = exports.initializeSocket = void 0;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("./config");
const webhook_service_1 = require("./modules/webhooks/webhook.service");
const campaigns_socket_1 = require("./modules/campaigns/campaigns.socket");
let io;
const initializeSocket = (server) => {
    io = new socket_io_1.Server(server, {
        cors: {
            origin: [
                config_1.config.frontendUrl,
                'https://wabmeta.com',
                'http://localhost:5173',
            ],
            methods: ['GET', 'POST'],
            credentials: true,
        },
        pingTimeout: 60000,
        pingInterval: 25000,
        transports: ['websocket', 'polling'],
    });
    // ✅ Initialize campaign socket service FIRST
    (0, campaigns_socket_1.initializeCampaignSocket)(io);
    console.log('✅ Campaign Socket Service initialized');
    // Authentication middleware
    io.use((socket, next) => {
        const token = socket.handshake.auth.token ||
            socket.handshake.headers.authorization?.split(' ')[1];
        if (!token) {
            console.error('❌ Socket connection rejected: No token provided');
            return next(new Error('Authentication required'));
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(token, config_1.config.jwtSecret);
            socket.userId = decoded.userId;
            socket.organizationId = decoded.organizationId;
            socket.email = decoded.email;
            console.log(`✅ Socket authenticated: ${decoded.email} (${decoded.userId})`);
            next();
        }
        catch (error) {
            console.error('❌ Socket authentication failed:', error.message);
            next(new Error('Invalid token'));
        }
    });
    // Connection handler
    io.on('connection', (socket) => {
        console.log(`🔌 Socket connected: ${socket.email || socket.userId} (${socket.id})`);
        // Join user to their organization room
        if (socket.organizationId) {
            socket.join(`org:${socket.organizationId}`);
            console.log(`📂 User joined org room: org:${socket.organizationId}`);
        }
        // Join user to their personal room
        if (socket.userId) {
            socket.join(`user:${socket.userId}`);
            console.log(`👤 User joined personal room: user:${socket.userId}`);
        }
        // ==========================================
        // CONVERSATION EVENTS (Existing)
        // ==========================================
        socket.on('join:conversation', (conversationId) => {
            if (!conversationId) {
                console.warn('⚠️ Attempted to join conversation without ID');
                return;
            }
            socket.join(`conversation:${conversationId}`);
            console.log(`💬 User joined conversation: ${conversationId}`);
        });
        socket.on('leave:conversation', (conversationId) => {
            if (!conversationId)
                return;
            socket.leave(`conversation:${conversationId}`);
            console.log(`💬 User left conversation: ${conversationId}`);
        });
        socket.on('typing:start', ({ conversationId }) => {
            if (!conversationId)
                return;
            socket.to(`conversation:${conversationId}`).emit('typing:start', {
                conversationId,
                userId: socket.userId,
                email: socket.email,
            });
        });
        socket.on('typing:stop', ({ conversationId }) => {
            if (!conversationId)
                return;
            socket.to(`conversation:${conversationId}`).emit('typing:stop', {
                conversationId,
                userId: socket.userId,
                email: socket.email,
            });
        });
        // ==========================================
        // CAMPAIGN EVENTS (New)
        // ==========================================
        socket.on('campaign:join', (campaignId) => {
            if (!campaignId) {
                console.warn('⚠️ Attempted to join campaign without ID');
                return;
            }
            socket.join(`campaign:${campaignId}`);
            console.log(`📢 User joined campaign room: campaign:${campaignId}`);
            // Confirm subscription
            socket.emit('campaign:joined', { campaignId });
        });
        socket.on('campaign:leave', (campaignId) => {
            if (!campaignId)
                return;
            socket.leave(`campaign:${campaignId}`);
            console.log(`📢 User left campaign room: campaign:${campaignId}`);
            // Confirm unsubscription
            socket.emit('campaign:left', { campaignId });
        });
        // ✅ Join all campaigns for organization (optional)
        socket.on('campaigns:subscribe', () => {
            if (!socket.organizationId) {
                console.warn('⚠️ Cannot subscribe to campaigns: No organizationId');
                return;
            }
            socket.join(`org:${socket.organizationId}:campaigns`);
            console.log(`📢 User subscribed to all organization campaigns`);
            socket.emit('campaigns:subscribed', {
                organizationId: socket.organizationId
            });
        });
        socket.on('campaigns:unsubscribe', () => {
            if (!socket.organizationId)
                return;
            socket.leave(`org:${socket.organizationId}:campaigns`);
            console.log(`📢 User unsubscribed from organization campaigns`);
            socket.emit('campaigns:unsubscribed', {
                organizationId: socket.organizationId
            });
        });
        // ==========================================
        // GENERAL EVENTS
        // ==========================================
        // Heartbeat/ping
        socket.on('ping', () => {
            socket.emit('pong', { timestamp: Date.now() });
        });
        // Request connection status
        socket.on('status', () => {
            socket.emit('status:response', {
                connected: true,
                userId: socket.userId,
                organizationId: socket.organizationId,
                rooms: Array.from(socket.rooms),
            });
        });
        // ==========================================
        // DISCONNECT HANDLER
        // ==========================================
        socket.on('disconnect', (reason) => {
            console.log(`❌ Socket disconnected: ${socket.email || socket.userId} (${reason})`);
            // Cleanup if needed
            if (socket.organizationId) {
                console.log(`🧹 Cleaned up rooms for org: ${socket.organizationId}`);
            }
        });
        // ==========================================
        // ERROR HANDLER
        // ==========================================
        socket.on('error', (error) => {
            console.error(`❌ Socket error for ${socket.email || socket.userId}:`, error);
        });
    });
    // ==========================================
    // WEBHOOK EVENT BROADCASTING (Existing)
    // ==========================================
    webhook_service_1.webhookEvents.on('newMessage', (data) => {
        if (!data.organizationId) {
            console.warn('⚠️ newMessage event missing organizationId');
            return;
        }
        // Broadcast to organization
        io.to(`org:${data.organizationId}`).emit('message:new', data);
        // Broadcast to specific conversation
        if (data.conversationId) {
            io.to(`conversation:${data.conversationId}`).emit('message:new', data);
        }
        console.log(`📨 Broadcasted new message to org:${data.organizationId}`);
    });
    webhook_service_1.webhookEvents.on('messageStatus', (data) => {
        if (!data.organizationId) {
            console.warn('⚠️ messageStatus event missing organizationId');
            return;
        }
        io.to(`org:${data.organizationId}`).emit('message:status', data);
        if (data.conversationId) {
            io.to(`conversation:${data.conversationId}`).emit('message:status', data);
        }
        console.log(`📊 Broadcasted message status to org:${data.organizationId}`);
    });
    // ✅ NEW: Campaign webhook events
    webhook_service_1.webhookEvents.on('campaignUpdate', (data) => {
        if (!data.organizationId || !data.campaignId) {
            console.warn('⚠️ campaignUpdate event missing required fields');
            return;
        }
        // Broadcast to organization campaigns room
        io.to(`org:${data.organizationId}:campaigns`).emit('campaign:update', data);
        // Broadcast to specific campaign room
        io.to(`campaign:${data.campaignId}`).emit('campaign:update', data);
        // Broadcast to organization
        io.to(`org:${data.organizationId}`).emit('campaign:update', data);
        console.log(`📢 Broadcasted campaign update: ${data.campaignId}`);
    });
    webhook_service_1.webhookEvents.on('campaignProgress', (data) => {
        if (!data.organizationId || !data.campaignId)
            return;
        io.to(`campaign:${data.campaignId}`).emit('campaign:progress', data);
        io.to(`org:${data.organizationId}:campaigns`).emit('campaign:progress', data);
        console.log(`📊 Broadcasted campaign progress: ${data.campaignId} (${data.percentage}%)`);
    });
    webhook_service_1.webhookEvents.on('campaignCompleted', (data) => {
        if (!data.organizationId || !data.campaignId)
            return;
        io.to(`campaign:${data.campaignId}`).emit('campaign:completed', data);
        io.to(`org:${data.organizationId}:campaigns`).emit('campaign:completed', data);
        io.to(`org:${data.organizationId}`).emit('campaign:completed', data);
        console.log(`✅ Broadcasted campaign completion: ${data.campaignId}`);
    });
    webhook_service_1.webhookEvents.on('campaignContactStatus', (data) => {
        if (!data.organizationId || !data.campaignId)
            return;
        io.to(`campaign:${data.campaignId}`).emit('campaign:contact:status', data);
        // Only log failed contacts to avoid spam
        if (data.status === 'FAILED') {
            console.log(`❌ Contact failed in campaign ${data.campaignId}: ${data.phone}`);
        }
    });
    console.log('✅ Socket.IO server initialized with all event handlers');
    return io;
};
exports.initializeSocket = initializeSocket;
const getIO = () => {
    if (!io) {
        throw new Error('Socket.IO not initialized. Call initializeSocket() first.');
    }
    return io;
};
exports.getIO = getIO;
// ==========================================
// UTILITY FUNCTIONS
// ==========================================
/**
 * Broadcast to organization
 */
const broadcastToOrganization = (organizationId, event, data) => {
    if (!io) {
        console.warn('⚠️ Cannot broadcast: Socket.IO not initialized');
        return;
    }
    io.to(`org:${organizationId}`).emit(event, data);
    console.log(`📡 Broadcasted ${event} to org:${organizationId}`);
};
exports.broadcastToOrganization = broadcastToOrganization;
/**
 * Broadcast to specific user
 */
const broadcastToUser = (userId, event, data) => {
    if (!io) {
        console.warn('⚠️ Cannot broadcast: Socket.IO not initialized');
        return;
    }
    io.to(`user:${userId}`).emit(event, data);
    console.log(`📡 Broadcasted ${event} to user:${userId}`);
};
exports.broadcastToUser = broadcastToUser;
/**
 * Broadcast to specific conversation
 */
const broadcastToConversation = (conversationId, event, data) => {
    if (!io) {
        console.warn('⚠️ Cannot broadcast: Socket.IO not initialized');
        return;
    }
    io.to(`conversation:${conversationId}`).emit(event, data);
    console.log(`📡 Broadcasted ${event} to conversation:${conversationId}`);
};
exports.broadcastToConversation = broadcastToConversation;
/**
 * Broadcast to specific campaign
 */
const broadcastToCampaign = (campaignId, event, data) => {
    if (!io) {
        console.warn('⚠️ Cannot broadcast: Socket.IO not initialized');
        return;
    }
    io.to(`campaign:${campaignId}`).emit(event, data);
    console.log(`📡 Broadcasted ${event} to campaign:${campaignId}`);
};
exports.broadcastToCampaign = broadcastToCampaign;
/**
 * Get active connections count
 */
const getActiveConnections = async () => {
    if (!io)
        return 0;
    const sockets = await io.fetchSockets();
    return sockets.length;
};
exports.getActiveConnections = getActiveConnections;
/**
 * Get connections for organization
 */
const getOrganizationConnections = async (organizationId) => {
    if (!io)
        return 0;
    const sockets = await io.in(`org:${organizationId}`).fetchSockets();
    return sockets.length;
};
exports.getOrganizationConnections = getOrganizationConnections;
/**
 * Get connections for campaign
 */
const getCampaignConnections = async (campaignId) => {
    if (!io)
        return 0;
    const sockets = await io.in(`campaign:${campaignId}`).fetchSockets();
    return sockets.length;
};
exports.getCampaignConnections = getCampaignConnections;
exports.default = {
    initializeSocket: exports.initializeSocket,
    getIO: exports.getIO,
    broadcastToOrganization: exports.broadcastToOrganization,
    broadcastToUser: exports.broadcastToUser,
    broadcastToConversation: exports.broadcastToConversation,
    broadcastToCampaign: exports.broadcastToCampaign,
    getActiveConnections: exports.getActiveConnections,
    getOrganizationConnections: exports.getOrganizationConnections,
    getCampaignConnections: exports.getCampaignConnections,
};
//# sourceMappingURL=socket.js.map