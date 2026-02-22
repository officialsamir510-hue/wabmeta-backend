"use strict";
// src/socket.ts - COMPLETE & OPTIMIZED
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCampaignConnections = exports.getOrganizationConnections = exports.getActiveConnections = exports.broadcastToCampaign = exports.broadcastToConversation = exports.broadcastToUser = exports.broadcastToOrganization = exports.getIO = exports.initializeSocket = void 0;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("./config");
let io;
let webhookEvents;
const initializeSocket = (server) => {
    io = new socket_io_1.Server(server, {
        cors: {
            origin: config_1.config.frontend.corsOrigins,
            methods: ['GET', 'POST'],
            credentials: true,
        },
        pingTimeout: 60000,
        pingInterval: 25000,
        transports: ['websocket', 'polling'],
    });
    // Initialize campaign socket (if available)
    initializeCampaignSocket();
    // Initialize webhook events
    initializeWebhookEvents();
    // Authentication middleware
    io.use((socket, next) => {
        const token = socket.handshake.auth.token ||
            socket.handshake.headers.authorization?.split(' ')[1];
        if (!token) {
            console.error('❌ Socket connection rejected: No token provided');
            return next(new Error('Authentication required'));
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(token, config_1.config.jwt.secret);
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
        // Join rooms
        if (socket.organizationId) {
            socket.join(`org:${socket.organizationId}`);
            console.log(`📂 User joined org room: org:${socket.organizationId}`);
        }
        if (socket.userId) {
            socket.join(`user:${socket.userId}`);
            console.log(`👤 User joined personal room: user:${socket.userId}`);
        }
        // ==========================================
        // CONVERSATION EVENTS
        // ==========================================
        socket.on('join:conversation', (conversationId) => {
            if (!conversationId)
                return;
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
        // CAMPAIGN EVENTS
        // ==========================================
        socket.on('campaign:join', (campaignId) => {
            if (!campaignId)
                return;
            socket.join(`campaign:${campaignId}`);
            console.log(`📢 User joined campaign room: campaign:${campaignId}`);
            socket.emit('campaign:joined', { campaignId });
        });
        socket.on('campaign:leave', (campaignId) => {
            if (!campaignId)
                return;
            socket.leave(`campaign:${campaignId}`);
            console.log(`📢 User left campaign room: campaign:${campaignId}`);
            socket.emit('campaign:left', { campaignId });
        });
        socket.on('campaigns:subscribe', () => {
            if (!socket.organizationId)
                return;
            socket.join(`org:${socket.organizationId}:campaigns`);
            console.log(`📢 User subscribed to all organization campaigns`);
            socket.emit('campaigns:subscribed', { organizationId: socket.organizationId });
        });
        socket.on('campaigns:unsubscribe', () => {
            if (!socket.organizationId)
                return;
            socket.leave(`org:${socket.organizationId}:campaigns`);
            console.log(`📢 User unsubscribed from organization campaigns`);
            socket.emit('campaigns:unsubscribed', { organizationId: socket.organizationId });
        });
        // ==========================================
        // GENERAL EVENTS
        // ==========================================
        socket.on('ping', () => {
            socket.emit('pong', { timestamp: Date.now() });
        });
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
        });
        socket.on('error', (error) => {
            console.error(`❌ Socket error for ${socket.email || socket.userId}:`, error);
        });
    });
    console.log('✅ Socket.IO server initialized');
    return io;
};
exports.initializeSocket = initializeSocket;
// ============================================
// INITIALIZE CAMPAIGN SOCKET (DYNAMIC IMPORT)
// ============================================
async function initializeCampaignSocket() {
    try {
        const campaignModule = await Promise.resolve().then(() => __importStar(require('./modules/campaigns/campaigns.socket')));
        if (campaignModule.initializeCampaignSocket && io) {
            campaignModule.initializeCampaignSocket(io);
            console.log('✅ Campaign Socket Service initialized');
        }
    }
    catch (error) {
        console.log('ℹ️  Campaign socket service not available');
    }
}
// ============================================
// INITIALIZE WEBHOOK EVENTS (DYNAMIC IMPORT)
// ============================================
async function initializeWebhookEvents() {
    try {
        const webhookModule = await Promise.resolve().then(() => __importStar(require('./modules/webhooks/webhook.service')));
        webhookEvents = webhookModule.webhookEvents;
        if (webhookEvents) {
            // Message events
            webhookEvents.on('newMessage', (data) => {
                if (!data.organizationId)
                    return;
                io.to(`org:${data.organizationId}`).emit('message:new', data);
                if (data.conversationId) {
                    io.to(`conversation:${data.conversationId}`).emit('message:new', data);
                }
            });
            webhookEvents.on('messageStatus', (data) => {
                if (!data.organizationId)
                    return;
                io.to(`org:${data.organizationId}`).emit('message:status', data);
                if (data.conversationId) {
                    io.to(`conversation:${data.conversationId}`).emit('message:status', data);
                }
            });
            // Campaign events
            webhookEvents.on('campaignUpdate', (data) => {
                if (!data.organizationId || !data.campaignId)
                    return;
                io.to(`campaign:${data.campaignId}`).emit('campaign:update', data);
                io.to(`org:${data.organizationId}:campaigns`).emit('campaign:update', data);
                io.to(`org:${data.organizationId}`).emit('campaign:update', data);
            });
            webhookEvents.on('campaignProgress', (data) => {
                if (!data.organizationId || !data.campaignId)
                    return;
                io.to(`campaign:${data.campaignId}`).emit('campaign:progress', data);
                io.to(`org:${data.organizationId}:campaigns`).emit('campaign:progress', data);
            });
            webhookEvents.on('campaignCompleted', (data) => {
                if (!data.organizationId || !data.campaignId)
                    return;
                io.to(`campaign:${data.campaignId}`).emit('campaign:completed', data);
                io.to(`org:${data.organizationId}:campaigns`).emit('campaign:completed', data);
                io.to(`org:${data.organizationId}`).emit('campaign:completed', data);
            });
            webhookEvents.on('campaignContactStatus', (data) => {
                if (!data.organizationId || !data.campaignId)
                    return;
                io.to(`campaign:${data.campaignId}`).emit('campaign:contact:status', data);
            });
            console.log('✅ Webhook events initialized');
        }
    }
    catch (error) {
        console.log('ℹ️  Webhook events not available');
    }
}
// ============================================
// UTILITY FUNCTIONS
// ============================================
const getIO = () => {
    if (!io) {
        throw new Error('Socket.IO not initialized');
    }
    return io;
};
exports.getIO = getIO;
const broadcastToOrganization = (organizationId, event, data) => {
    if (!io)
        return;
    io.to(`org:${organizationId}`).emit(event, data);
};
exports.broadcastToOrganization = broadcastToOrganization;
const broadcastToUser = (userId, event, data) => {
    if (!io)
        return;
    io.to(`user:${userId}`).emit(event, data);
};
exports.broadcastToUser = broadcastToUser;
const broadcastToConversation = (conversationId, event, data) => {
    if (!io)
        return;
    io.to(`conversation:${conversationId}`).emit(event, data);
};
exports.broadcastToConversation = broadcastToConversation;
const broadcastToCampaign = (campaignId, event, data) => {
    if (!io)
        return;
    io.to(`campaign:${campaignId}`).emit(event, data);
};
exports.broadcastToCampaign = broadcastToCampaign;
const getActiveConnections = async () => {
    if (!io)
        return 0;
    const sockets = await io.fetchSockets();
    return sockets.length;
};
exports.getActiveConnections = getActiveConnections;
const getOrganizationConnections = async (organizationId) => {
    if (!io)
        return 0;
    const sockets = await io.in(`org:${organizationId}`).fetchSockets();
    return sockets.length;
};
exports.getOrganizationConnections = getOrganizationConnections;
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