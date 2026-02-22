// src/socket.ts - COMPLETE & OPTIMIZED

import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from './config';

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
let webhookEvents: any;

export const initializeSocket = (server: HttpServer) => {
  io = new Server(server, {
    cors: {
      origin: config.frontend.corsOrigins as unknown as string[],
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
  io.use((socket: AuthenticatedSocket, next) => {
    const token =
      socket.handshake.auth.token ||
      socket.handshake.headers.authorization?.split(' ')[1];

    if (!token) {
      console.error('❌ Socket connection rejected: No token provided');
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;

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

    socket.on('join:conversation', (conversationId: string) => {
      if (!conversationId) return;
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
    // CAMPAIGN EVENTS
    // ==========================================

    socket.on('campaign:join', (campaignId: string) => {
      if (!campaignId) return;
      socket.join(`campaign:${campaignId}`);
      console.log(`📢 User joined campaign room: campaign:${campaignId}`);
      socket.emit('campaign:joined', { campaignId });
    });

    socket.on('campaign:leave', (campaignId: string) => {
      if (!campaignId) return;
      socket.leave(`campaign:${campaignId}`);
      console.log(`📢 User left campaign room: campaign:${campaignId}`);
      socket.emit('campaign:left', { campaignId });
    });

    socket.on('campaigns:subscribe', () => {
      if (!socket.organizationId) return;
      socket.join(`org:${socket.organizationId}:campaigns`);
      console.log(`📢 User subscribed to all organization campaigns`);
      socket.emit('campaigns:subscribed', { organizationId: socket.organizationId });
    });

    socket.on('campaigns:unsubscribe', () => {
      if (!socket.organizationId) return;
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

// ============================================
// INITIALIZE CAMPAIGN SOCKET (DYNAMIC IMPORT)
// ============================================

async function initializeCampaignSocket() {
  try {
    const campaignModule = await import('./modules/campaigns/campaigns.socket');
    if (campaignModule.initializeCampaignSocket && io) {
      campaignModule.initializeCampaignSocket(io);
      console.log('✅ Campaign Socket Service initialized');
    }
  } catch (error) {
    console.log('ℹ️  Campaign socket service not available');
  }
}

// ============================================
// INITIALIZE WEBHOOK EVENTS (DYNAMIC IMPORT)
// ============================================

async function initializeWebhookEvents() {
  try {
    const webhookModule = await import('./modules/webhooks/webhook.service') as any;
    webhookEvents = webhookModule.webhookEvents;

    if (webhookEvents) {
      // Message events
      webhookEvents.on('newMessage', (data: any) => {
        if (!data.organizationId) return;
        io.to(`org:${data.organizationId}`).emit('message:new', data);
        if (data.conversationId) {
          io.to(`conversation:${data.conversationId}`).emit('message:new', data);
        }
      });

      webhookEvents.on('messageStatus', (data: any) => {
        if (!data.organizationId) return;
        io.to(`org:${data.organizationId}`).emit('message:status', data);
        if (data.conversationId) {
          io.to(`conversation:${data.conversationId}`).emit('message:status', data);
        }
      });

      // Campaign events
      webhookEvents.on('campaignUpdate', (data: any) => {
        if (!data.organizationId || !data.campaignId) return;
        io.to(`campaign:${data.campaignId}`).emit('campaign:update', data);
        io.to(`org:${data.organizationId}:campaigns`).emit('campaign:update', data);
        io.to(`org:${data.organizationId}`).emit('campaign:update', data);
      });

      webhookEvents.on('campaignProgress', (data: any) => {
        if (!data.organizationId || !data.campaignId) return;
        io.to(`campaign:${data.campaignId}`).emit('campaign:progress', data);
        io.to(`org:${data.organizationId}:campaigns`).emit('campaign:progress', data);
      });

      webhookEvents.on('campaignCompleted', (data: any) => {
        if (!data.organizationId || !data.campaignId) return;
        io.to(`campaign:${data.campaignId}`).emit('campaign:completed', data);
        io.to(`org:${data.organizationId}:campaigns`).emit('campaign:completed', data);
        io.to(`org:${data.organizationId}`).emit('campaign:completed', data);
      });

      webhookEvents.on('campaignContactStatus', (data: any) => {
        if (!data.organizationId || !data.campaignId) return;
        io.to(`campaign:${data.campaignId}`).emit('campaign:contact:status', data);
      });

      console.log('✅ Webhook events initialized');
    }
  } catch (error) {
    console.log('ℹ️  Webhook events not available');
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

export const getIO = (): Server => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

export const broadcastToOrganization = (
  organizationId: string,
  event: string,
  data: any
) => {
  if (!io) return;
  io.to(`org:${organizationId}`).emit(event, data);
};

export const broadcastToUser = (userId: string, event: string, data: any) => {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
};

export const broadcastToConversation = (
  conversationId: string,
  event: string,
  data: any
) => {
  if (!io) return;
  io.to(`conversation:${conversationId}`).emit(event, data);
};

export const broadcastToCampaign = (
  campaignId: string,
  event: string,
  data: any
) => {
  if (!io) return;
  io.to(`campaign:${campaignId}`).emit(event, data);
};

export const getActiveConnections = async (): Promise<number> => {
  if (!io) return 0;
  const sockets = await io.fetchSockets();
  return sockets.length;
};

export const getOrganizationConnections = async (
  organizationId: string
): Promise<number> => {
  if (!io) return 0;
  const sockets = await io.in(`org:${organizationId}`).fetchSockets();
  return sockets.length;
};

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