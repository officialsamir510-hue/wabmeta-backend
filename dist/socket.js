"use strict";
// src/socket.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIO = exports.initializeSocket = void 0;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("./config");
const webhook_service_1 = require("./modules/webhooks/webhook.service");
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
    });
    // Authentication middleware
    io.use((socket, next) => {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
        if (!token) {
            return next(new Error('Authentication required'));
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(token, config_1.config.jwtSecret);
            socket.userId = decoded.userId;
            socket.organizationId = decoded.organizationId;
            next();
        }
        catch (error) {
            next(new Error('Invalid token'));
        }
    });
    io.on('connection', (socket) => {
        console.log(`[Socket] User connected: ${socket.userId}`);
        // Join user to their organization room
        if (socket.organizationId) {
            socket.join(`org:${socket.organizationId}`);
            console.log(`[Socket] User joined org room: org:${socket.organizationId}`);
        }
        // Join user to their personal room
        socket.join(`user:${socket.userId}`);
        // Handle joining specific conversation
        socket.on('join:conversation', (conversationId) => {
            socket.join(`conversation:${conversationId}`);
            console.log(`[Socket] User joined conversation: ${conversationId}`);
        });
        // Handle leaving conversation
        socket.on('leave:conversation', (conversationId) => {
            socket.leave(`conversation:${conversationId}`);
            console.log(`[Socket] User left conversation: ${conversationId}`);
        });
        // Handle typing indicator
        socket.on('typing:start', ({ conversationId }) => {
            socket.to(`conversation:${conversationId}`).emit('typing:start', {
                conversationId,
                userId: socket.userId,
            });
        });
        socket.on('typing:stop', ({ conversationId }) => {
            socket.to(`conversation:${conversationId}`).emit('typing:stop', {
                conversationId,
                userId: socket.userId,
            });
        });
        // Handle disconnect
        socket.on('disconnect', (reason) => {
            console.log(`[Socket] User disconnected: ${socket.userId}, reason: ${reason}`);
        });
    });
    // Listen to webhook events and broadcast
    webhook_service_1.webhookEvents.on('newMessage', (data) => {
        io.to(`org:${data.organizationId}`).emit('message:new', data);
        io.to(`conversation:${data.conversationId}`).emit('message:new', data);
    });
    webhook_service_1.webhookEvents.on('messageStatus', (data) => {
        io.to(`org:${data.organizationId}`).emit('message:status', data);
    });
    return io;
};
exports.initializeSocket = initializeSocket;
const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized');
    }
    return io;
};
exports.getIO = getIO;
exports.default = { initializeSocket: exports.initializeSocket, getIO: exports.getIO };
//# sourceMappingURL=socket.js.map