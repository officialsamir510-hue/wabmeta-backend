// src/socket.ts - SIMPLIFIED WORKING VERSION

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

export const initializeSocket = (server: HttpServer) => {
  console.log('🔌 Starting Socket.IO...');

  // ✅ SIMPLIFIED CORS - allow all for debugging
  io = new Server(server, {
    cors: {
      origin: '*', // Allow all origins for now
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['polling', 'websocket'],
    path: '/socket.io/',
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // ✅ Auth middleware - lenient
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
        console.warn('⚠️ Invalid token, allowing anyway');
      }
    }
    next(); // Always allow connection
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`🔌 Connected: ${socket.id} (user: ${socket.userId || 'anon'})`);

    // Auto-join org room
    if (socket.organizationId) {
      socket.join(`org:${socket.organizationId}`);
      console.log(`📂 Auto-joined org:${socket.organizationId}`);
    }

    // Manual org join
    socket.on('org:join', (orgId: string) => {
      if (orgId) {
        socket.organizationId = orgId;
        socket.join(`org:${orgId}`);
        console.log(`📂 Joined org:${orgId}`);
      }
    });

    // Campaign rooms
    socket.on('campaign:join', (id: string) => {
      if (id) {
        socket.join(`campaign:${id}`);
        console.log(`📊 Joined campaign:${id}`);
      }
    });

    socket.on('campaign:leave', (id: string) => {
      if (id) socket.leave(`campaign:${id}`);
    });

    // Conversation rooms
    socket.on('join:conversation', (id: string) => {
      if (id) {
        socket.join(`conversation:${id}`);
        console.log(`💬 Joined conversation:${id}`);
      }
    });

    socket.on('leave:conversation', (id: string) => {
      if (id) socket.leave(`conversation:${id}`);
    });

    // Ping
    socket.on('ping', () => {
      socket.emit('pong', { time: Date.now() });
    });

    socket.on('disconnect', (reason) => {
      console.log(`🔌 Disconnected: ${socket.id} (${reason})`);
    });
  });

  // Init campaign socket
  initializeCampaignSocket(io);

  // Wire webhook events
  wireWebhookEvents();

  console.log('✅ Socket.IO ready');
  return io;
};

function wireWebhookEvents() {
  import('./modules/webhooks/webhook.service')
    .then((module) => {
      const { webhookEvents } = module;

      if (!webhookEvents) return;

      webhookEvents.on('newMessage', (data: any) => {
        if (!data?.organizationId) return;
        io.to(`org:${data.organizationId}`).emit('message:new', data);
        if (data.conversationId) {
          io.to(`conversation:${data.conversationId}`).emit('message:new', data);
        }
        console.log(`📡 Emitted message:new`);
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
        console.log(`📡 Emitted message:status: ${data.messageId} -> ${data.status}`);
      });

      console.log('✅ Webhook events wired');
    })
    .catch((e) => console.log('ℹ️ Webhook events not available'));
}

export const getIO = (): Server => {
  if (!io) throw new Error('Socket not initialized');
  return io;
};

export default { initializeSocket, getIO };