"use strict";
// src/socket.ts - COMPLETE FINAL (org:join + webhookEvents broadcast)
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
exports.getIO = exports.initializeSocket = void 0;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("./config");
let io;
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
        path: '/socket.io',
    });
    // ✅ Auth middleware
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token ||
            socket.handshake.headers.authorization?.split(' ')[1];
        if (!token)
            return next(new Error('Authentication required'));
        try {
            const decoded = jsonwebtoken_1.default.verify(token, config_1.config.jwt.secret);
            socket.userId = decoded.userId || decoded.id;
            socket.organizationId = decoded.organizationId;
            socket.email = decoded.email;
            // ✅ fallback org from handshake
            const orgFromAuth = socket.handshake.auth?.organizationId;
            if (!socket.organizationId && orgFromAuth) {
                socket.organizationId = String(orgFromAuth);
            }
            next();
        }
        catch (e) {
            next(new Error('Invalid token'));
        }
    });
    io.on('connection', (socket) => {
        console.log(`🔌 Socket connected: ${socket.email || socket.userId} (${socket.id})`);
        if (socket.organizationId) {
            socket.join(`org:${socket.organizationId}`);
            console.log(`📂 Joined org room: org:${socket.organizationId}`);
        }
        else {
            console.warn('⚠️ Socket has no organizationId (org room not joined)');
        }
        if (socket.userId) {
            socket.join(`user:${socket.userId}`);
        }
        // ✅ allow client to join org explicitly
        socket.on('org:join', (orgId) => {
            if (!orgId)
                return;
            socket.organizationId = socket.organizationId || orgId;
            socket.join(`org:${orgId}`);
            console.log(`📂 org:join => org:${orgId}`);
        });
        // Conversation rooms
        socket.on('join:conversation', (conversationId) => {
            if (!conversationId)
                return;
            socket.join(`conversation:${conversationId}`);
        });
        socket.on('leave:conversation', (conversationId) => {
            if (!conversationId)
                return;
            socket.leave(`conversation:${conversationId}`);
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
        socket.on('ping', () => socket.emit('pong', { timestamp: Date.now() }));
    });
    // ✅ Hook webhookEvents -> socket broadcast
    initializeWebhookEvents().catch((e) => console.error('initializeWebhookEvents error', e));
    console.log('✅ Socket.IO server initialized');
    return io;
};
exports.initializeSocket = initializeSocket;
async function initializeWebhookEvents() {
    try {
        const webhookModule = (await Promise.resolve().then(() => __importStar(require('./modules/webhooks/webhook.service'))));
        const webhookEvents = webhookModule.webhookEvents;
        if (!webhookEvents) {
            console.log('ℹ️ webhookEvents not found, realtime inbound disabled');
            return;
        }
        webhookEvents.on('newMessage', (data) => {
            if (!data?.organizationId)
                return;
            io.to(`org:${data.organizationId}`).emit('message:new', data);
            if (data.conversationId) {
                io.to(`conversation:${data.conversationId}`).emit('message:new', data);
            }
        });
        webhookEvents.on('conversationUpdated', (data) => {
            if (!data?.organizationId)
                return;
            io.to(`org:${data.organizationId}`).emit('conversation:updated', data);
        });
        webhookEvents.on('messageStatus', (data) => {
            if (!data?.organizationId)
                return;
            io.to(`org:${data.organizationId}`).emit('message:status', data);
            if (data.conversationId) {
                io.to(`conversation:${data.conversationId}`).emit('message:status', data);
            }
        });
        console.log('✅ Webhook events wired to Socket.IO');
    }
    catch (e) {
        console.log('ℹ️ Webhook events not available');
    }
}
// Utility
const getIO = () => {
    if (!io)
        throw new Error('Socket.IO not initialized');
    return io;
};
exports.getIO = getIO;
exports.default = { initializeSocket: exports.initializeSocket, getIO: exports.getIO };
//# sourceMappingURL=socket.js.map