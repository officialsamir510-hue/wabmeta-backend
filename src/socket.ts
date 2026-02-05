// src/socket.ts

import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import { verifyAccessToken } from './utils/jwt';
import prisma from './config/database';
import { config } from './config';

let io: SocketServer | null = null;

interface AuthenticatedSocket extends Socket {
  userId?: string;
  organizationId?: string;
}

export const initializeSocket = (httpServer: HttpServer): SocketServer => {
  io = new SocketServer(httpServer, {
    cors: {
      origin: config.frontendUrl,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = verifyAccessToken(token);
      
      // Verify user exists
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user || user.status === 'SUSPENDED') {
        return next(new Error('User not found or suspended'));
      }

      socket.userId = decoded.userId;
      socket.organizationId = decoded.organizationId;
      
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  // Connection handler
  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`🔌 User connected: ${socket.userId}`);

    // Join organization room
    if (socket.organizationId) {
      socket.join(`org:${socket.organizationId}`);
      console.log(`👥 User joined org room: ${socket.organizationId}`);
    }

    // Join user's personal room
    socket.join(`user:${socket.userId}`);

    // ==========================================
    // EVENT HANDLERS
    // ==========================================

    // Join specific conversation
    socket.on('join:conversation', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
      console.log(`💬 User ${socket.userId} joined conversation: ${conversationId}`);
    });

    // Leave conversation
    socket.on('leave:conversation', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
      console.log(`👋 User ${socket.userId} left conversation: ${conversationId}`);
    });

    // Typing indicators
    socket.on('typing:start', (conversationId: string) => {
      socket.to(`conversation:${conversationId}`).emit('user:typing', {
        conversationId,
        userId: socket.userId,
        isTyping: true,
      });
    });

    socket.on('typing:stop', (conversationId: string) => {
      socket.to(`conversation:${conversationId}`).emit('user:typing', {
        conversationId,
        userId: socket.userId,
        isTyping: false,
      });
    });

    // Mark messages as read
    socket.on('message:read', async (conversationId: string) => {
      if (socket.organizationId) {
        await prisma.conversation.update({
          where: { id: conversationId },
          data: {
            isRead: true,
            unreadCount: 0,
          },
        });
      }
    });

    // Disconnect handler
    socket.on('disconnect', (reason) => {
      console.log(`🔌 User disconnected: ${socket.userId}, reason: ${reason}`);
    });

    // Error handler
    socket.on('error', (error) => {
      console.error(`Socket error for user ${socket.userId}:`, error);
    });
  });

  console.log('🔌 Socket.io initialized');
  return io;
};

// ==========================================
// EMIT HELPERS
// ==========================================

export const getIO = (): SocketServer | null => io;

// Emit to organization
export const emitToOrganization = (organizationId: string, event: string, data: any) => {
  if (io) {
    io.to(`org:${organizationId}`).emit(event, data);
  }
};

// Emit to specific conversation
export const emitToConversation = (conversationId: string, event: string, data: any) => {
  if (io) {
    io.to(`conversation:${conversationId}`).emit(event, data);
  }
};

// Emit to specific user
export const emitToUser = (userId: string, event: string, data: any) => {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
};

// Emit new message event
export const emitNewMessage = (organizationId: string, conversationId: string, message: any) => {
  emitToOrganization(organizationId, 'message:new', { ...message, conversationId });
  emitToConversation(conversationId, 'message:new', message);
};

// Emit message status update
export const emitMessageStatus = (organizationId: string, messageId: string, status: string) => {
  emitToOrganization(organizationId, 'message:status', { messageId, status });
};

// Emit conversation update
export const emitConversationUpdate = (organizationId: string, conversation: any) => {
  emitToOrganization(organizationId, 'conversation:updated', conversation);
};

// Emit new conversation
export const emitNewConversation = (organizationId: string, conversation: any) => {
  emitToOrganization(organizationId, 'conversation:new', conversation);
};