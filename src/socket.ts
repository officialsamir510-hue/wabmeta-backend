// src/socket.ts - OPTIMIZED VERSION

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

let io: Server;
let webhookListenersAttached = false; // ✅ Flag to prevent duplicate listeners

export const initializeSocket = (server: HttpServer) => {
  console.log('🔌 Starting Socket.IO...');

  io = new Server(server, {
    cors: {
      origin: [...config.frontend.corsOrigins],
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
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(' ')[1];

    if (token) {
      try {
        const decoded = jwt.verify(token, config.jwt.secret) as any;
        socket.userId = decoded.userId || decoded.id;
        socket.organizationId = decoded.organizationId || socket.handshake.auth?.organizationId;
        socket.email = decoded.email;
      } catch (e) {
        console.warn('⚠️ Invalid token');
      }
    }
    next();
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
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
    socket.on('org:join', (orgId: string) => {
      if (orgId) {
        socket.organizationId = orgId;
        socket.join(`org:${orgId}`);
      }
    });

    // Campaign rooms
    socket.on('campaign:join', (id: string) => {
      if (id) socket.join(`campaign:${id}`);
    });

    socket.on('campaign:leave', (id: string) => {
      if (id) socket.leave(`campaign:${id}`);
    });

    // Conversation rooms
    socket.on('join:conversation', (id: string) => {
      if (id) socket.join(`conversation:${id}`);
    });

    socket.on('leave:conversation', (id: string) => {
      if (id) socket.leave(`conversation:${id}`);
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
  initializeCampaignSocket(io);

  // ✅ CRITICAL FIX: Attach webhook listeners ONLY ONCE
  if (!webhookListenersAttached) {
    wireWebhookEvents();
    webhookListenersAttached = true;
  }

  console.log('✅ Socket.IO ready');
  return io;
};

function wireWebhookEvents() {
  import('./modules/webhooks/webhook.service')
    .then((module) => {
      const { webhookEvents } = module;

      if (!webhookEvents) return;

      // ✅ CRITICAL: Remove all previous listeners first
      webhookEvents.removeAllListeners('newMessage');
      webhookEvents.removeAllListeners('conversationUpdated');
      webhookEvents.removeAllListeners('messageStatus');

      // ✅ NEW: Throttled event emission (max 10 events/sec per org)
      const emissionQueue = new Map<string, NodeJS.Timeout>();

      webhookEvents.on('newMessage', (data: any) => {
        if (!data?.organizationId) return;

        const orgId = data.organizationId;
        const key = `newMessage:${orgId}`;

        // ✅ Throttle: Clear existing timeout
        if (emissionQueue.has(key)) {
          clearTimeout(emissionQueue.get(key));
        }

        // ✅ Batch emit after 100ms
        const timeout = setTimeout(() => {
          io.to(`org:${orgId}`).emit('message:new', data);
          if (data.conversationId) {
            io.to(`conversation:${data.conversationId}`).emit('message:new', data);
          }
          emissionQueue.delete(key);
        }, 100);

        emissionQueue.set(key, timeout);
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

      console.log('✅ Webhook events wired with throttling');
    })
    .catch((e) => console.log('ℹ️ Webhook events not available'));
}

export const getIO = (): Server => {
  if (!io) throw new Error('Socket not initialized');
  return io;
};

// ✅ NEW: Graceful shutdown
export const closeSocketIO = async () => {
  if (io) {
    console.log('🔌 Closing Socket.IO...');
    await new Promise<void>((resolve) => {
      io.close(() => {
        console.log('✅ Socket.IO closed');
        resolve();
      });
    });
  }
};

export default { initializeSocket, getIO, closeSocketIO };