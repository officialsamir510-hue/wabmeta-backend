// src/socket.ts - COMPLETE FINAL (org:join + webhookEvents broadcast)

import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from './config';
import { initializeCampaignSocket } from './modules/campaigns/campaigns.socket';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  organizationId?: string;
  email?: string;
}

interface JWTPayload {
  userId?: string;
  id?: string;
  organizationId?: string;
  email?: string;
}

let io: Server;

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
    path: '/socket.io',
  });

  // ✅ Auth middleware
  io.use((socket: AuthenticatedSocket, next) => {
    const token =
      (socket.handshake.auth as any)?.token ||
      socket.handshake.headers.authorization?.split(' ')[1];

    if (!token) return next(new Error('Authentication required'));

    try {
      const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;

      socket.userId = decoded.userId || decoded.id;
      socket.organizationId = decoded.organizationId;
      socket.email = decoded.email;

      // ✅ fallback org from handshake
      const orgFromAuth = (socket.handshake.auth as any)?.organizationId;
      if (!socket.organizationId && orgFromAuth) {
        socket.organizationId = String(orgFromAuth);
      }

      next();
    } catch (e: any) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`🔌 Socket connected: ${socket.email || socket.userId} (${socket.id})`);

    if (socket.organizationId) {
      socket.join(`org:${socket.organizationId}`);
      console.log(`📂 Joined org room: org:${socket.organizationId}`);
    } else {
      console.warn('⚠️ Socket has no organizationId (org room not joined)');
    }

    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
    }

    // ✅ allow client to join org explicitly
    socket.on('org:join', (orgId: string) => {
      if (!orgId) return;
      socket.organizationId = socket.organizationId || orgId;
      socket.join(`org:${orgId}`);
      console.log(`📂 org:join => org:${orgId}`);
    });

    // Conversation rooms
    socket.on('join:conversation', (conversationId: string) => {
      if (!conversationId) return;
      socket.join(`conversation:${conversationId}`);
    });

    socket.on('leave:conversation', (conversationId: string) => {
      if (!conversationId) return;
      socket.leave(`conversation:${conversationId}`);
    });

    // ✅ Campaign room join
    socket.on('campaign:join', (campaignId: string) => {
      if (!campaignId) return;
      socket.join(`campaign:${campaignId}`);
      console.log(`📊 Joined campaign room: campaign:${campaignId}`);
    });

    socket.on('campaign:leave', (campaignId: string) => {
      if (!campaignId) return;
      socket.leave(`campaign:${campaignId}`);
      console.log(`📊 Left campaign room: campaign:${campaignId}`);
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

    socket.on('ping', () => socket.emit('pong', { timestamp: Date.now() }));
  });

  // ✅ Hook webhookEvents -> socket broadcast
  initializeWebhookEvents().catch((e) => console.error('initializeWebhookEvents error', e));

  // ✅ Initialize campaign socket service
  initializeCampaignSocket(io);

  console.log('✅ Socket.IO server initialized');
  return io;
};

async function initializeWebhookEvents() {
  try {
    const webhookModule = (await import('./modules/webhooks/webhook.service')) as any;
    const webhookEvents = webhookModule.webhookEvents;

    if (!webhookEvents) {
      console.log('ℹ️ webhookEvents not found, realtime inbound disabled');
      return;
    }

    webhookEvents.on('newMessage', (data: any) => {
      if (!data?.organizationId) return;

      io.to(`org:${data.organizationId}`).emit('message:new', data);
      if (data.conversationId) {
        io.to(`conversation:${data.conversationId}`).emit('message:new', data);
      }
    });

    webhookEvents.on('conversationUpdated', (data: any) => {
      if (!data?.organizationId) return;
      io.to(`org:${data.organizationId}`).emit('conversation:updated', data);
    });

    webhookEvents.on('messageStatus', (data: any) => {
      if (!data?.organizationId) return;

      io.to(`org:${data.organizationId}`).emit('message:status', data);
      if (data.conversationId) {
        io.to(`conversation:${data.conversationId}`).emit('message:status', data);
      }
    });

    console.log('✅ Webhook events wired to Socket.IO');
  } catch (e) {
    console.log('ℹ️ Webhook events not available');
  }
}

// Utility
export const getIO = (): Server => {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
};

export default { initializeSocket, getIO };