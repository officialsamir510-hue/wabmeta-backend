// src/socket.ts

import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from './config';
import { webhookEvents } from './modules/webhooks/webhook.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  organizationId?: string;
}

let io: Server;

export const initializeSocket = (server: HttpServer) => {
  io = new Server(server, {
    cors: {
      origin: [
        config.frontendUrl,
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
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, config.jwtSecret) as {
        userId: string;
        organizationId?: string;
      };
      socket.userId = decoded.userId;
      socket.organizationId = decoded.organizationId;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`[Socket] User connected: ${socket.userId}`);

    // Join user to their organization room
    if (socket.organizationId) {
      socket.join(`org:${socket.organizationId}`);
      console.log(`[Socket] User joined org room: org:${socket.organizationId}`);
    }

    // Join user to their personal room
    socket.join(`user:${socket.userId}`);

    // Handle joining specific conversation
    socket.on('join:conversation', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
      console.log(`[Socket] User joined conversation: ${conversationId}`);
    });

    // Handle leaving conversation
    socket.on('leave:conversation', (conversationId: string) => {
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
  webhookEvents.on('newMessage', (data: any) => {
    io.to(`org:${data.organizationId}`).emit('message:new', data);
    io.to(`conversation:${data.conversationId}`).emit('message:new', data);
  });

  webhookEvents.on('messageStatus', (data: any) => {
    io.to(`org:${data.organizationId}`).emit('message:status', data);
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

export default { initializeSocket, getIO };