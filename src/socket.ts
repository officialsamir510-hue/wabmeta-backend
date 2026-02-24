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
  console.log('🔌 Initializing Socket.IO server...');
  console.log('   CORS Origins:', config.frontend.corsOrigins);

  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        // Allow all origins in development or if origin matches allowed list
        const allowed = [
          'http://localhost:3000',
          'http://localhost:5173',
          'http://localhost:5174',
          'https://wabmeta.com',
          'https://www.wabmeta.com',
        ];

        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) {
          return callback(null, true);
        }

        if (allowed.includes(origin) || origin.includes('wabmeta')) {
          callback(null, true);
        } else {
          console.warn(`⚠️ Socket CORS blocked origin: ${origin}`);
          callback(null, true); // Allow anyway for now
        }
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
    path: '/socket.io',
    allowEIO3: true, // ✅ Allow Engine.IO 3 clients
  });

  // ✅ Auth middleware - more lenient
  io.use((socket: AuthenticatedSocket, next) => {
    try {
      const token =
        (socket.handshake.auth as any)?.token ||
        socket.handshake.headers.authorization?.split(' ')[1] ||
        (socket.handshake.query as any)?.token;

      console.log(`🔐 Socket auth attempt: ${socket.id.substring(0, 8)}...`, {
        hasToken: !!token,
        authKeys: Object.keys(socket.handshake.auth || {}),
      });

      if (!token) {
        console.log('⚠️ No token provided, allowing anonymous connection');
        return next();
      }

      const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;

      socket.userId = decoded.userId || decoded.id;
      socket.organizationId = decoded.organizationId;
      socket.email = decoded.email;

      // Fallback org from handshake
      const orgFromAuth = (socket.handshake.auth as any)?.organizationId;
      if (!socket.organizationId && orgFromAuth) {
        socket.organizationId = String(orgFromAuth);
      }

      console.log(`✅ Socket authenticated: ${socket.email || socket.userId}`);
      next();
    } catch (e: any) {
      console.warn(`⚠️ Socket auth failed: ${e.message}, allowing connection anyway`);
      next(); // Allow connection anyway
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`🔌 Socket connected: ${socket.email || socket.userId || 'anonymous'} (${socket.id})`);

    // Auto-join org room
    if (socket.organizationId) {
      const rooms = [
        `org:${socket.organizationId}`,
        `org:${socket.organizationId}:campaigns`,
        `org:${socket.organizationId}:inbox`,
      ];
      rooms.forEach(room => socket.join(room));
      console.log(`📂 Auto-joined rooms:`, rooms);
    }

    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
    }

    // ✅ Org join handler
    socket.on('org:join', (orgId: string) => {
      if (!orgId) return;

      socket.organizationId = socket.organizationId || orgId;
      const rooms = [
        `org:${orgId}`,
        `org:${orgId}:campaigns`,
        `org:${orgId}:inbox`,
      ];
      rooms.forEach(room => socket.join(room));
      console.log(`📂 Explicit org join: ${orgId}`);
    });

    // Campaign rooms
    socket.on('campaign:join', (campaignId: string) => {
      if (!campaignId) return;
      socket.join(`campaign:${campaignId}`);
      console.log(`📊 Joined campaign: ${campaignId}`);
    });

    socket.on('campaign:leave', (campaignId: string) => {
      if (!campaignId) return;
      socket.leave(`campaign:${campaignId}`);
    });

    // Conversation rooms
    socket.on('join:conversation', (conversationId: string) => {
      if (!conversationId) return;
      socket.join(`conversation:${conversationId}`);
      console.log(`💬 Joined conversation: ${conversationId}`);
    });

    socket.on('leave:conversation', (conversationId: string) => {
      if (!conversationId) return;
      socket.leave(`conversation:${conversationId}`);
    });

    // Typing indicators
    socket.on('typing:start', ({ conversationId }) => {
      if (conversationId) {
        socket.to(`conversation:${conversationId}`).emit('typing:start', {
          conversationId,
          userId: socket.userId,
        });
      }
    });

    socket.on('typing:stop', ({ conversationId }) => {
      if (conversationId) {
        socket.to(`conversation:${conversationId}`).emit('typing:stop', {
          conversationId,
          userId: socket.userId,
        });
      }
    });

    // Ping/pong
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now(), socketId: socket.id });
    });

    socket.on('disconnect', (reason) => {
      console.log(`🔌 Socket disconnected: ${socket.id} (${reason})`);
    });

    socket.on('error', (error) => {
      console.error(`❌ Socket error for ${socket.id}:`, error);
    });
  });

  // Log connection stats periodically
  setInterval(() => {
    const sockets = io.sockets.sockets.size;
    if (sockets > 0) {
      console.log(`📊 Socket stats: ${sockets} connected clients`);
    }
  }, 60000);

  // ✅ Initialize campaign socket
  initializeCampaignSocket(io);
  console.log('✅ Campaign Socket Service initialized');

  // ✅ Wire webhook events
  initializeWebhookEvents().catch((e) => console.error('initializeWebhookEvents error', e));

  console.log('✅ Socket.IO server initialized successfully');
  return io;
};

async function initializeWebhookEvents() {
  try {
    const webhookModule = await import('./modules/webhooks/webhook.service');
    const webhookEvents = webhookModule.webhookEvents;

    if (!webhookEvents) {
      console.log('ℹ️ webhookEvents not found');
      return;
    }

    // New message
    webhookEvents.on('newMessage', (data: any) => {
      if (!data?.organizationId) return;

      const rooms = [
        `org:${data.organizationId}`,
        `org:${data.organizationId}:inbox`,
      ];

      rooms.forEach(room => {
        io.to(room).emit('message:new', data);
      });

      if (data.conversationId) {
        io.to(`conversation:${data.conversationId}`).emit('message:new', data);
      }

      console.log(`📡 Emitted newMessage to org:${data.organizationId}`);
    });

    // Conversation updated
    webhookEvents.on('conversationUpdated', (data: any) => {
      if (!data?.organizationId) return;

      io.to(`org:${data.organizationId}`).emit('conversation:updated', data);
      io.to(`org:${data.organizationId}:inbox`).emit('conversation:updated', data);
    });

    // ✅ CRITICAL: Message status update
    webhookEvents.on('messageStatus', (data: any) => {
      if (!data?.organizationId) return;

      console.log(`📡 Emitting messageStatus to org:${data.organizationId}`, {
        messageId: data.messageId,
        status: data.status,
      });

      // Emit to all relevant rooms
      const rooms = [
        `org:${data.organizationId}`,
        `org:${data.organizationId}:inbox`,
      ];

      rooms.forEach(room => {
        io.to(room).emit('message:status', data);
      });

      if (data.conversationId) {
        io.to(`conversation:${data.conversationId}`).emit('message:status', data);
      }
    });

    // Campaign status
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
    console.error('❌ Failed to initialize webhook events:', e);
  }
}

export const getIO = (): Server => {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
};

export default { initializeSocket, getIO };