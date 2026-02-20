// 📁 src/socket.ts - COMPLETE WITH CAMPAIGN SOCKET INTEGRATION

import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from './config';
import { webhookEvents } from './modules/webhooks/webhook.service';
import { initializeCampaignSocket } from './modules/campaigns/campaigns.socket';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  organizationId?: string;
  email?: string;
}

interface JWTPayload {
  userId: string;
  organizationId?: string;
  email?: string;
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
    transports: ['websocket', 'polling'],
  });

  // ✅ Initialize campaign socket service FIRST
  initializeCampaignSocket(io);
  console.log('✅ Campaign Socket Service initialized');

  // Authentication middleware
  io.use((socket: AuthenticatedSocket, next) => {
    const token =
      socket.handshake.auth.token ||
      socket.handshake.headers.authorization?.split(' ')[1];

    if (!token) {
      console.error('❌ Socket connection rejected: No token provided');
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, config.jwtSecret) as JWTPayload;

      socket.userId = decoded.userId;
      socket.organizationId = decoded.organizationId;
      socket.email = decoded.email;

      console.log(`✅ Socket authenticated: ${decoded.email} (${decoded.userId})`);
      next();
    } catch (error: any) {
      console.error('❌ Socket authentication failed:', error.message);
      next(new Error('Invalid token'));
    }
  });

  // Connection handler
  io.on('connection', (socket: AuthenticatedSocket) => {
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

    socket.on('join:conversation', (conversationId: string) => {
      if (!conversationId) {
        console.warn('⚠️ Attempted to join conversation without ID');
        return;
      }
      socket.join(`conversation:${conversationId}`);
      console.log(`💬 User joined conversation: ${conversationId}`);
    });

    socket.on('leave:conversation', (conversationId: string) => {
      if (!conversationId) return;
      socket.leave(`conversation:${conversationId}`);
      console.log(`💬 User left conversation: ${conversationId}`);
    });

    socket.on('typing:start', ({ conversationId }) => {
      if (!conversationId) return;
      socket.to(`conversation:${conversationId}`).emit('typing:start', {
        conversationId,
        userId: socket.userId,
        email: socket.email,
      });
    });

    socket.on('typing:stop', ({ conversationId }) => {
      if (!conversationId) return;
      socket.to(`conversation:${conversationId}`).emit('typing:stop', {
        conversationId,
        userId: socket.userId,
        email: socket.email,
      });
    });

    // ==========================================
    // CAMPAIGN EVENTS (New)
    // ==========================================

    socket.on('campaign:join', (campaignId: string) => {
      if (!campaignId) {
        console.warn('⚠️ Attempted to join campaign without ID');
        return;
      }
      socket.join(`campaign:${campaignId}`);
      console.log(`📢 User joined campaign room: campaign:${campaignId}`);

      // Confirm subscription
      socket.emit('campaign:joined', { campaignId });
    });

    socket.on('campaign:leave', (campaignId: string) => {
      if (!campaignId) return;
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
      if (!socket.organizationId) return;

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

  webhookEvents.on('newMessage', (data: any) => {
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

  webhookEvents.on('messageStatus', (data: any) => {
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
  webhookEvents.on('campaignUpdate', (data: any) => {
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

  webhookEvents.on('campaignProgress', (data: any) => {
    if (!data.organizationId || !data.campaignId) return;

    io.to(`campaign:${data.campaignId}`).emit('campaign:progress', data);
    io.to(`org:${data.organizationId}:campaigns`).emit('campaign:progress', data);

    console.log(`📊 Broadcasted campaign progress: ${data.campaignId} (${data.percentage}%)`);
  });

  webhookEvents.on('campaignCompleted', (data: any) => {
    if (!data.organizationId || !data.campaignId) return;

    io.to(`campaign:${data.campaignId}`).emit('campaign:completed', data);
    io.to(`org:${data.organizationId}:campaigns`).emit('campaign:completed', data);
    io.to(`org:${data.organizationId}`).emit('campaign:completed', data);

    console.log(`✅ Broadcasted campaign completion: ${data.campaignId}`);
  });

  webhookEvents.on('campaignContactStatus', (data: any) => {
    if (!data.organizationId || !data.campaignId) return;

    io.to(`campaign:${data.campaignId}`).emit('campaign:contact:status', data);

    // Only log failed contacts to avoid spam
    if (data.status === 'FAILED') {
      console.log(`❌ Contact failed in campaign ${data.campaignId}: ${data.phone}`);
    }
  });

  console.log('✅ Socket.IO server initialized with all event handlers');

  return io;
};

export const getIO = (): Server => {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initializeSocket() first.');
  }
  return io;
};

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Broadcast to organization
 */
export const broadcastToOrganization = (
  organizationId: string,
  event: string,
  data: any
) => {
  if (!io) {
    console.warn('⚠️ Cannot broadcast: Socket.IO not initialized');
    return;
  }

  io.to(`org:${organizationId}`).emit(event, data);
  console.log(`📡 Broadcasted ${event} to org:${organizationId}`);
};

/**
 * Broadcast to specific user
 */
export const broadcastToUser = (
  userId: string,
  event: string,
  data: any
) => {
  if (!io) {
    console.warn('⚠️ Cannot broadcast: Socket.IO not initialized');
    return;
  }

  io.to(`user:${userId}`).emit(event, data);
  console.log(`📡 Broadcasted ${event} to user:${userId}`);
};

/**
 * Broadcast to specific conversation
 */
export const broadcastToConversation = (
  conversationId: string,
  event: string,
  data: any
) => {
  if (!io) {
    console.warn('⚠️ Cannot broadcast: Socket.IO not initialized');
    return;
  }

  io.to(`conversation:${conversationId}`).emit(event, data);
  console.log(`📡 Broadcasted ${event} to conversation:${conversationId}`);
};

/**
 * Broadcast to specific campaign
 */
export const broadcastToCampaign = (
  campaignId: string,
  event: string,
  data: any
) => {
  if (!io) {
    console.warn('⚠️ Cannot broadcast: Socket.IO not initialized');
    return;
  }

  io.to(`campaign:${campaignId}`).emit(event, data);
  console.log(`📡 Broadcasted ${event} to campaign:${campaignId}`);
};

/**
 * Get active connections count
 */
export const getActiveConnections = async (): Promise<number> => {
  if (!io) return 0;

  const sockets = await io.fetchSockets();
  return sockets.length;
};

/**
 * Get connections for organization
 */
export const getOrganizationConnections = async (
  organizationId: string
): Promise<number> => {
  if (!io) return 0;

  const sockets = await io.in(`org:${organizationId}`).fetchSockets();
  return sockets.length;
};

/**
 * Get connections for campaign
 */
export const getCampaignConnections = async (
  campaignId: string
): Promise<number> => {
  if (!io) return 0;

  const sockets = await io.in(`campaign:${campaignId}`).fetchSockets();
  return sockets.length;
};

export default {
  initializeSocket,
  getIO,
  broadcastToOrganization,
  broadcastToUser,
  broadcastToConversation,
  broadcastToCampaign,
  getActiveConnections,
  getOrganizationConnections,
  getCampaignConnections,
};