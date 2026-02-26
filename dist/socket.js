"use strict";
// src/socket.ts - OPTIMIZED VERSION
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
exports.closeSocketIO = exports.getIO = exports.initializeSocket = void 0;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("./config");
const campaigns_socket_1 = require("./modules/campaigns/campaigns.socket");
let io;
let webhookListenersAttached = false; // ✅ Flag to prevent duplicate listeners
const initializeSocket = (server) => {
    console.log('🔌 Starting Socket.IO...');
    io = new socket_io_1.Server(server, {
        cors: {
            origin: [...config_1.config.frontend.corsOrigins],
            methods: ['GET', 'POST'],
            credentials: true,
            allowedHeaders: [
                'Content-Type',
                'Authorization',
                'X-Requested-With',
                'X-Organization-Id',
                'x-organization-id',
                'Accept',
                'Origin',
            ],
        },
        transports: ['websocket', 'polling'],
        path: '/socket.io/',
        // ✅ CRITICAL: Connection limits
        pingTimeout: 60000,
        pingInterval: 25000,
        maxHttpBufferSize: 1e6, // 1MB max message size
        // ✅ NEW: Performance optimizations
        perMessageDeflate: {
            threshold: 1024, // Compress messages > 1KB
        },
        httpCompression: {
            threshold: 1024,
        },
    });
    // ✅ Connection tracking
    let connectionCount = 0;
    const MAX_CONNECTIONS = 10000; // Safety limit
    // Auth middleware
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token ||
            socket.handshake.headers?.authorization?.split(' ')[1];
        if (token) {
            try {
                const decoded = jsonwebtoken_1.default.verify(token, config_1.config.jwt.secret);
                socket.userId = decoded.userId || decoded.id;
                socket.organizationId = decoded.organizationId || socket.handshake.auth?.organizationId;
                socket.email = decoded.email;
            }
            catch (e) {
                console.warn('⚠️ Invalid token');
            }
        }
        next();
    });
    io.on('connection', (socket) => {
        connectionCount++;
        // ✅ CRITICAL: Limit connections
        if (connectionCount > MAX_CONNECTIONS) {
            console.error('🚨 Max connections reached!');
            socket.emit('error', 'Server capacity reached');
            socket.disconnect(true);
            return;
        }
        console.log(`🔌 Connected: ${socket.id} (total: ${connectionCount})`);
        // Auto-join org room
        if (socket.organizationId) {
            socket.join(`org:${socket.organizationId}`);
        }
        // Manual org join
        socket.on('org:join', (orgId) => {
            if (orgId) {
                socket.organizationId = orgId;
                socket.join(`org:${orgId}`);
            }
        });
        // Campaign rooms
        socket.on('campaign:join', (id) => {
            if (id)
                socket.join(`campaign:${id}`);
        });
        socket.on('campaign:leave', (id) => {
            if (id)
                socket.leave(`campaign:${id}`);
        });
        // Conversation rooms
        socket.on('join:conversation', (id) => {
            if (id)
                socket.join(`conversation:${id}`);
        });
        socket.on('leave:conversation', (id) => {
            if (id)
                socket.leave(`conversation:${id}`);
        });
        // Ping/pong
        socket.on('ping', () => {
            socket.emit('pong', { time: Date.now() });
        });
        socket.on('disconnect', (reason) => {
            connectionCount--;
            console.log(`🔌 Disconnected: ${socket.id} (${reason}), total: ${connectionCount}`);
        });
    });
    // Init campaign socket
    (0, campaigns_socket_1.initializeCampaignSocket)(io);
    // ✅ CRITICAL FIX: Attach webhook listeners ONLY ONCE
    if (!webhookListenersAttached) {
        wireWebhookEvents();
        webhookListenersAttached = true;
    }
    console.log('✅ Socket.IO ready');
    return io;
};
exports.initializeSocket = initializeSocket;
function wireWebhookEvents() {
    Promise.resolve().then(() => __importStar(require('./modules/webhooks/webhook.service'))).then((module) => {
        const { webhookEvents } = module;
        if (!webhookEvents)
            return;
        // ✅ CRITICAL: Remove all previous listeners first
        webhookEvents.removeAllListeners('newMessage');
        webhookEvents.removeAllListeners('conversationUpdated');
        webhookEvents.removeAllListeners('messageStatus');
        // ✅ CRITICAL FIX: Prevent duplicate emissions
        const emissionQueue = new Map();
        webhookEvents.on('newMessage', (data) => {
            if (!data?.organizationId)
                return;
            const orgId = data.organizationId;
            const conversationId = data.conversationId;
            const messageId = data.message?.id || data.message?.waMessageId || Math.random().toString();
            // ✅ FIXED: Use message-specific key
            const key = `newMessage:${messageId}`;
            // ✅ Clear existing timeout for THIS specific message
            if (emissionQueue.has(key)) {
                clearTimeout(emissionQueue.get(key));
            }
            // ✅ Debounce: Wait 30ms before emitting
            const timeout = setTimeout(() => {
                const rooms = [`org:${orgId}`];
                if (conversationId) {
                    rooms.push(`conversation:${conversationId}`);
                }
                // ✅ Single emission to multiple rooms
                io.to(rooms).emit('message:new', data);
                emissionQueue.delete(key);
                console.log(`✅ Emitted message:new for ${messageId}`);
            }, 30);
            emissionQueue.set(key, timeout);
        });
        webhookEvents.on('conversationUpdated', (data) => {
            if (!data?.organizationId)
                return;
            io.to(`org:${data.organizationId}`).emit('conversation:updated', data);
        });
        webhookEvents.on('messageStatus', (data) => {
            if (!data?.organizationId)
                return;
            // ✅ FIX: Use room chaining here as well
            let target = io.to(`org:${data.organizationId}`);
            if (data.conversationId) {
                target = target.to(`conversation:${data.conversationId}`);
            }
            target.emit('message:status', data);
        });
        console.log('✅ Webhook events wired with throttling');
    })
        .catch((e) => console.log('ℹ️ Webhook events not available'));
}
const getIO = () => {
    if (!io)
        throw new Error('Socket not initialized');
    return io;
};
exports.getIO = getIO;
// ✅ NEW: Graceful shutdown
const closeSocketIO = async () => {
    if (io) {
        console.log('🔌 Closing Socket.IO...');
        await new Promise((resolve) => {
            io.close(() => {
                console.log('✅ Socket.IO closed');
                resolve();
            });
        });
    }
};
exports.closeSocketIO = closeSocketIO;
exports.default = { initializeSocket: exports.initializeSocket, getIO: exports.getIO, closeSocketIO: exports.closeSocketIO };
//# sourceMappingURL=socket.js.map