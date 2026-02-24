// src/socket.ts - COMPLETE FIXED VERSION

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

    if (!token) {
      console.log('⚠️ Socket connection without token, allowing...');
      return next();
    }

    try {
      const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
      socket.userId = decoded.userId || decoded.id;
      socket.organizationId = decoded.organizationId;
      socket.email = decoded.email;

      const orgFromAuth = (socket.handshake.auth as any)?.organizationId;
      if (!socket.organizationId && orgFromAuth) {
        socket.organizationId = String(orgFromAuth);
      }

      next();
    } catch (e: any) {
      console.warn('⚠️ Invalid socket token, allowing connection anyway');
      next();
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`🔌 Socket connected: ${socket.email || socket.userId || 'anonymous'} (${socket.id})`);

    // ✅ Auto-join org room
    if (socket.organizationId) {
      socket.join(`org:${socket.organizationId}`);
      socket.join(`org:${socket.organizationId}:campaigns`);
      socket.join(`org:${socket.organizationId}:inbox`);
      console.log(`📂 Auto-joined rooms for org: ${socket.organizationId}`);
    }

    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
    }

    // ✅ Allow client to join org explicitly
    socket.on('org:join', (orgId: string) => {
      if (!orgId) return;
      socket.organizationId = socket.organizationId || orgId;
      socket.join(`org:${orgId}`);
      socket.join(`org:${orgId}:campaigns`);
      socket.join(`org:${orgId}:inbox`);
      console.log(`📂 Explicit join: org:${orgId}`);
    });

    // ✅ Campaign room handlers
    socket.on('campaign:join', (campaignId: string) => {
      if (!campaignId) return;
      socket.join(`campaign:${campaignId}`);
      console.log(`📊 Joined campaign room: campaign:${campaignId}`);
    });

    socket.on('campaign:leave', (campaignId: string) => {
      if (!campaignId) return;
      socket.leave(`campaign:${campaignId}`);
    });

    // ✅ Conversation room handlers
    socket.on('join:conversation', (conversationId: string) => {
      if (!conversationId) return;
      socket.join(`conversation:${conversationId}`);
      console.log(`💬 Joined conversation room: ${conversationId}`);
    });

    socket.on('leave:conversation', (conversationId: string) => {
      if (!conversationId) return;
      socket.leave(`conversation:${conversationId}`);
    });

    // Typing indicators
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

    socket.on('disconnect', (reason) => {
      console.log(`🔌 Socket disconnected: ${socket.id} (${reason})`);
    });
  });

  // ✅ Initialize campaign socket service
  initializeCampaignSocket(io);
  console.log('✅ Campaign Socket Service initialized');

  // ✅ Hook webhookEvents -> socket broadcast
  initializeWebhookEvents().catch((e) => console.error('initializeWebhookEvents error', e));

  console.log('✅ Socket.IO server initialized');
  return io;
};

async function initializeWebhookEvents() {
  try {
    const webhookModule = (await import('./modules/webhooks/webhook.service')) as any;
    const webhookEvents = webhookModule.webhookEvents;

    if (!webhookEvents) {
      console.log('ℹ️ webhookEvents not found');
      return;
    }

    // ✅ New message
    webhookEvents.on('newMessage', (data: any) => {
      if (!data?.organizationId) return;

      console.log(`📡 [SOCKET] Emitting newMessage to org:${data.organizationId}`);

      io.to(`org:${data.organizationId}`).emit('message:new', data);
      io.to(`org:${data.organizationId}:inbox`).emit('message:new', data);

      if (data.conversationId) {
        io.to(`conversation:${data.conversationId}`).emit('message:new', data);
      }
    });

    // ✅ Conversation updated
    webhookEvents.on('conversationUpdated', (data: any) => {
      if (!data?.organizationId) return;

      io.to(`org:${data.organizationId}`).emit('conversation:updated', data);
      io.to(`org:${data.organizationId}:inbox`).emit('conversation:updated', data);
    });

    // ✅ CRITICAL: Message status update
    webhookEvents.on('messageStatus', (data: any) => {
      if (!data?.organizationId) return;

      console.log(`📡 [SOCKET] Emitting messageStatus: ${data.messageId} -> ${data.status}`);

      // Emit to all relevant rooms
      io.to(`org:${data.organizationId}`).emit('message:status', data);
      io.to(`org:${data.organizationId}:inbox`).emit('message:status', data);

      if (data.conversationId) {
        io.to(`conversation:${data.conversationId}`).emit('message:status', data);
      }
    });

    // ✅ Campaign status from webhook
    webhookEvents.on('campaignStatus', (data: any) => {
      if (!data?.organizationId) return;

      io.to(`org:${data.organizationId}`).emit('campaign:progress', data);
      io.to(`org:${data.organizationId}:campaigns`).emit('campaign:progress', data);

      if (data.campaignId) {
        io.to(`campaign:${data.campaignId}`).emit('campaign:progress', data);
      }
    });

    console.log('✅ Webhook events wired to Socket.IO');
  } catch (e) {
    console.log('ℹ️ Webhook events not available');
  }
}

export const getIO = (): Server => {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
};

export default { initializeSocket, getIO };