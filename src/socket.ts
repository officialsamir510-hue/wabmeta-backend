// src/socket.ts

import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from './config';
import prisma from './config/database';

// ============================================
// TYPES
// ============================================

interface AuthenticatedSocket extends Socket {
  userId?: string;
  organizationId?: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName?: string;
    avatar?: string;
  };
}

interface JWTPayload {
  userId: string;
  email: string;
  organizationId?: string;
}

interface OnlineUser {
  id: string;
  socketId: string;
  organizationId: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName?: string;
    avatar?: string;
  };
  connectedAt: Date;
}

// ============================================
// GLOBAL STATE
// ============================================

let io: Server;
const onlineUsers = new Map<string, OnlineUser>(); // userId -> OnlineUser
const userSockets = new Map<string, Set<string>>(); // userId -> Set of socketIds (for multiple tabs)

// ============================================
// SOCKET EVENTS ENUM
// ============================================

export const SocketEvents = {
  // Connection
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  ERROR: 'error',
  RECONNECT: 'reconnect',

  // Messages
  NEW_MESSAGE: 'new_message',
  MESSAGE_SENT: 'message_sent',
  MESSAGE_STATUS_UPDATE: 'message_status_update',
  MESSAGE_FAILED: 'message_failed',
  MESSAGE_DELETED: 'message_deleted',

  // Conversations
  CONVERSATION_UPDATED: 'conversation_updated',
  CONVERSATION_NEW: 'new_conversation',
  CONVERSATION_ARCHIVED: 'conversation_archived',
  CONVERSATION_ASSIGNED: 'conversation_assigned',
  CONVERSATION_UNREAD_COUNT: 'conversation_unread_count',

  // Typing
  TYPING_START: 'typing_start',
  TYPING_STOP: 'typing_stop',
  USER_TYPING: 'user_typing',

  // Presence
  USER_ONLINE: 'user_online',
  USER_OFFLINE: 'user_offline',
  ONLINE_USERS: 'online_users',
  PRESENCE_UPDATE: 'presence_update',

  // Notifications
  NOTIFICATION: 'notification',
  NOTIFICATION_READ: 'notification_read',

  // Campaigns
  CAMPAIGN_STATUS_UPDATE: 'campaign_status_update',
  CAMPAIGN_PROGRESS: 'campaign_progress',

  // Webhooks
  WEBHOOK_RECEIVED: 'webhook_received',

  // Rooms
  JOIN_ORGANIZATION: 'join_organization',
  LEAVE_ORGANIZATION: 'leave_organization',
  JOIN_CONVERSATION: 'join_conversation',
  LEAVE_CONVERSATION: 'leave_conversation',

  // Ping/Pong for connection health
  PING: 'ping',
  PONG: 'pong',
} as const;

// ============================================
// INITIALIZE SOCKET.IO
// ============================================

export const initializeSocket = (server: HTTPServer): Server => {
  // ✅ FIXED: Comprehensive allowed origins list
  const allowedOrigins = [
    // Local development
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    
    // Production domains
    'https://wabmeta.com',
    'https://www.wabmeta.com',
    
    // Render preview URLs (if any)
    'https://wabmeta.onrender.com',
    'https://wabmeta-frontend.onrender.com',
  ];

  // Add config.frontendUrl if not already in list
  if (config.frontendUrl && !allowedOrigins.includes(config.frontendUrl)) {
    allowedOrigins.push(config.frontendUrl);
  }

  console.log('🔌 Socket.IO allowed origins:', allowedOrigins);

  io = new Server(server, {
    cors: {
      // ✅ FIXED: More permissive origin handling
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, Postman, etc.)
        if (!origin) {
          return callback(null, true);
        }
        
        // Check if origin is in allowed list
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        
        // Allow any origin in development
        if (config.nodeEnv === 'development') {
          console.log(`⚠️ Socket allowing dev origin: ${origin}`);
          return callback(null, true);
        }
        
        // In production, be more lenient but log
        console.warn(`⚠️ Socket CORS non-whitelisted origin: ${origin}`);
        // Allow anyway to prevent connection issues
        return callback(null, true);
      },
      methods: ['GET', 'POST'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization'],
    },
    // ✅ Connection settings
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
    allowEIO3: true, // Allow Engine.IO v3 clients
    
    // ✅ Additional settings for stability
    connectTimeout: 45000,
    maxHttpBufferSize: 1e6, // 1MB
    path: '/socket.io/',
  });

  // ============================================
  // AUTHENTICATION MIDDLEWARE
  // ============================================

  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      // ✅ Multiple ways to get token
      const token = 
        socket.handshake.auth?.token || 
        socket.handshake.headers?.authorization?.replace('Bearer ', '') ||
        (socket.handshake.query?.token as string) ||
        null;

      if (!token || typeof token !== 'string') {
        console.log('❌ Socket auth failed: No token provided');
        return next(new Error('Authentication required'));
      }

      // Verify JWT
      let decoded: JWTPayload;
      try {
        // ✅ Try multiple secret keys
        const jwtSecret = config.jwt?.secret || config.jwtSecret;
        
        if (!jwtSecret) {
          console.error('❌ JWT secret not configured');
          return next(new Error('Server configuration error'));
        }
        
        decoded = jwt.verify(token, jwtSecret) as JWTPayload;
      } catch (jwtError: any) {
        console.log('❌ Socket auth failed: Invalid JWT -', jwtError.message);
        return next(new Error('Invalid or expired token'));
      }

      if (!decoded.userId) {
        return next(new Error('Invalid token payload'));
      }

      // Get user from database
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          avatar: true,
          status: true,
          memberships: {
            where: { joinedAt: { not: null } },
            select: { organizationId: true },
            take: 1,
          },
        },
      });

      if (!user) {
        return next(new Error('User not found'));
      }

      if (user.status === 'SUSPENDED') {
        return next(new Error('User account is suspended'));
      }

      // Attach user info to socket
      socket.userId = user.id;
      socket.organizationId = decoded.organizationId || user.memberships[0]?.organizationId;
      socket.user = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName || undefined,
        avatar: user.avatar || undefined,
      };

      console.log(`✅ Socket authenticated: ${user.email} (org: ${socket.organizationId})`);
      next();
    } catch (error: any) {
      console.error('❌ Socket auth error:', error.message);
      next(new Error('Authentication failed'));
    }
  });

  // ============================================
  // CONNECTION HANDLER
  // ============================================

  io.on(SocketEvents.CONNECTION, (socket: AuthenticatedSocket) => {
    const userId = socket.userId!;
    const orgId = socket.organizationId;
    
    console.log(`🔌 Socket connected: ${socket.id} (user: ${userId}, org: ${orgId})`);

    // Track online user
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId)!.add(socket.id);

    // Store online user info
    if (orgId) {
      onlineUsers.set(userId, {
        id: userId,
        socketId: socket.id,
        organizationId: orgId,
        user: socket.user!,
        connectedAt: new Date(),
      });
    }

    // Auto-join organization room
    if (orgId) {
      const orgRoom = `org:${orgId}`;
      socket.join(orgRoom);
      console.log(`   Joined room: ${orgRoom}`);

      // Notify others that user is online
      socket.to(orgRoom).emit(SocketEvents.USER_ONLINE, {
        userId: userId,
        user: socket.user,
        timestamp: new Date().toISOString(),
      });

      // Send current online users to the newly connected user
      const orgOnlineUsers = getOrganizationOnlineUsers(orgId);
      socket.emit(SocketEvents.ONLINE_USERS, orgOnlineUsers);
    }

    // ========================================
    // JOIN ORGANIZATION
    // ========================================
    socket.on(SocketEvents.JOIN_ORGANIZATION, (organizationId: string) => {
      if (socket.organizationId !== organizationId) {
        console.log(`⚠️ User ${userId} tried to join unauthorized org: ${organizationId}`);
        socket.emit(SocketEvents.ERROR, { message: 'Unauthorized organization' });
        return;
      }

      const room = `org:${organizationId}`;
      socket.join(room);
      console.log(`   User ${userId} joined: ${room}`);
    });

    // ========================================
    // JOIN CONVERSATION (for typing indicators)
    // ========================================
    socket.on(SocketEvents.JOIN_CONVERSATION, async (conversationId: string) => {
      // Verify user has access to this conversation
      try {
        const conversation = await prisma.conversation.findFirst({
          where: {
            id: conversationId,
            organizationId: socket.organizationId,
          },
          select: { id: true },
        });

        if (!conversation) {
          socket.emit(SocketEvents.ERROR, { message: 'Conversation not found' });
          return;
        }

        const room = `conversation:${conversationId}`;
        socket.join(room);
        console.log(`   User ${userId} joined: ${room}`);
      } catch (error) {
        console.error('Error joining conversation:', error);
      }
    });

    // ========================================
    // LEAVE CONVERSATION
    // ========================================
    socket.on(SocketEvents.LEAVE_CONVERSATION, (conversationId: string) => {
      const room = `conversation:${conversationId}`;
      socket.leave(room);
      console.log(`   User ${userId} left: ${room}`);
    });

    // ========================================
    // TYPING INDICATORS
    // ========================================
    socket.on(SocketEvents.TYPING_START, (data: { conversationId: string }) => {
      if (!data.conversationId) return;
      
      const room = `conversation:${data.conversationId}`;
      socket.to(room).emit(SocketEvents.USER_TYPING, {
        conversationId: data.conversationId,
        userId: userId,
        user: socket.user,
        isTyping: true,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on(SocketEvents.TYPING_STOP, (data: { conversationId: string }) => {
      if (!data.conversationId) return;
      
      const room = `conversation:${data.conversationId}`;
      socket.to(room).emit(SocketEvents.USER_TYPING, {
        conversationId: data.conversationId,
        userId: userId,
        user: socket.user,
        isTyping: false,
        timestamp: new Date().toISOString(),
      });
    });

    // ========================================
    // PING/PONG FOR CONNECTION HEALTH
    // ========================================
    socket.on(SocketEvents.PING, () => {
      socket.emit(SocketEvents.PONG, { timestamp: Date.now() });
    });

    // ========================================
    // DISCONNECT
    // ========================================
    socket.on(SocketEvents.DISCONNECT, (reason) => {
      console.log(`🔌 Socket disconnected: ${socket.id} (reason: ${reason})`);

      // Remove from user sockets
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        
        // If no more sockets for this user, they're fully offline
        if (sockets.size === 0) {
          userSockets.delete(userId);
          onlineUsers.delete(userId);

          // Notify others that user is offline
          if (orgId) {
            socket.to(`org:${orgId}`).emit(SocketEvents.USER_OFFLINE, {
              userId: userId,
              timestamp: new Date().toISOString(),
            });
          }
        }
      }
    });

    // ========================================
    // ERROR HANDLER
    // ========================================
    socket.on(SocketEvents.ERROR, (error) => {
      console.error(`❌ Socket error for ${socket.id}:`, error);
    });
  });

  console.log('✅ Socket.IO initialized');
  return io;
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get online users for an organization
 */
const getOrganizationOnlineUsers = (organizationId: string): OnlineUser[] => {
  const users: OnlineUser[] = [];
  
  onlineUsers.forEach((user) => {
    if (user.organizationId === organizationId) {
      users.push(user);
    }
  });
  
  return users;
};

/**
 * Check if a user is online
 */
export const isUserOnline = (userId: string): boolean => {
  return onlineUsers.has(userId);
};

/**
 * Get all online user IDs for an organization
 */
export const getOnlineUserIds = (organizationId: string): string[] => {
  const userIds: string[] = [];
  
  onlineUsers.forEach((user) => {
    if (user.organizationId === organizationId) {
      userIds.push(user.id);
    }
  });
  
  return userIds;
};

// ============================================
// EMIT HELPERS
// ============================================

/**
 * Get IO instance
 */
export const getIO = (): Server => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

/**
 * Safe getIO that doesn't throw
 */
export const getIOSafe = (): Server | null => {
  return io || null;
};

/**
 * Emit to organization room
 */
export const emitToOrganization = (
  organizationId: string,
  event: string,
  data: any
): void => {
  if (!io) {
    console.warn('Socket.IO not initialized, skipping emit');
    return;
  }

  const room = `org:${organizationId}`;
  io.to(room).emit(event, data);
  console.log(`📤 Emitted ${event} to ${room}`);
};

/**
 * Emit to conversation room
 */
export const emitToConversation = (
  conversationId: string,
  event: string,
  data: any
): void => {
  if (!io) {
    console.warn('Socket.IO not initialized, skipping emit');
    return;
  }

  const room = `conversation:${conversationId}`;
  io.to(room).emit(event, data);
  console.log(`📤 Emitted ${event} to ${room}`);
};

/**
 * Emit to specific user (all their tabs/devices)
 */
export const emitToUser = (
  userId: string,
  event: string,
  data: any
): void => {
  if (!io) {
    console.warn('Socket.IO not initialized, skipping emit');
    return;
  }

  const sockets = userSockets.get(userId);
  if (sockets && sockets.size > 0) {
    sockets.forEach((socketId) => {
      io.to(socketId).emit(event, data);
    });
    console.log(`📤 Emitted ${event} to user ${userId} (${sockets.size} sockets)`);
  }
};

/**
 * Emit new message event
 */
export const emitNewMessage = (
  organizationId: string,
  conversationId: string,
  message: any,
  conversation?: any
): void => {
  const payload = {
    message,
    conversation,
    conversationId,
    timestamp: new Date().toISOString(),
  };

  // Emit to organization room
  emitToOrganization(organizationId, SocketEvents.NEW_MESSAGE, payload);

  // Also emit to conversation room for active viewers
  emitToConversation(conversationId, SocketEvents.NEW_MESSAGE, payload);
};

/**
 * Emit message status update
 */
export const emitMessageStatusUpdate = (
  organizationId: string,
  conversationId: string,
  messageId: string,
  status: string,
  timestamp?: Date
): void => {
  const payload = {
    conversationId,
    messageId,
    status,
    timestamp: timestamp?.toISOString() || new Date().toISOString(),
  };

  emitToOrganization(organizationId, SocketEvents.MESSAGE_STATUS_UPDATE, payload);
  emitToConversation(conversationId, SocketEvents.MESSAGE_STATUS_UPDATE, payload);
};

/**
 * Emit message sent confirmation
 */
export const emitMessageSent = (
  organizationId: string,
  conversationId: string,
  message: any
): void => {
  emitToOrganization(organizationId, SocketEvents.MESSAGE_SENT, {
    conversationId,
    message,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Emit message failed
 */
export const emitMessageFailed = (
  organizationId: string,
  conversationId: string,
  messageId: string,
  error: string
): void => {
  emitToOrganization(organizationId, SocketEvents.MESSAGE_FAILED, {
    conversationId,
    messageId,
    error,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Emit conversation updated
 */
export const emitConversationUpdated = (
  organizationId: string,
  conversation: any
): void => {
  emitToOrganization(organizationId, SocketEvents.CONVERSATION_UPDATED, {
    conversation,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Emit new conversation
 */
export const emitNewConversation = (
  organizationId: string,
  conversation: any
): void => {
  emitToOrganization(organizationId, SocketEvents.CONVERSATION_NEW, {
    conversation,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Emit conversation assigned
 */
export const emitConversationAssigned = (
  organizationId: string,
  conversationId: string,
  assignedTo: string | null,
  assignedUser?: any
): void => {
  emitToOrganization(organizationId, SocketEvents.CONVERSATION_ASSIGNED, {
    conversationId,
    assignedTo,
    assignedUser,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Emit unread count update
 */
export const emitUnreadCount = (
  organizationId: string,
  conversationId: string,
  unreadCount: number
): void => {
  emitToOrganization(organizationId, SocketEvents.CONVERSATION_UNREAD_COUNT, {
    conversationId,
    unreadCount,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Emit notification
 */
export const emitNotification = (
  userId: string,
  notification: {
    id: string;
    type: string;
    title: string;
    description: string;
    actionUrl?: string;
    metadata?: any;
  }
): void => {
  emitToUser(userId, SocketEvents.NOTIFICATION, {
    ...notification,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Emit campaign status update
 */
export const emitCampaignStatusUpdate = (
  organizationId: string,
  campaignId: string,
  status: string,
  stats?: {
    totalContacts?: number;
    sentCount?: number;
    deliveredCount?: number;
    failedCount?: number;
  }
): void => {
  emitToOrganization(organizationId, SocketEvents.CAMPAIGN_STATUS_UPDATE, {
    campaignId,
    status,
    stats,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Emit campaign progress
 */
export const emitCampaignProgress = (
  organizationId: string,
  campaignId: string,
  progress: {
    sent: number;
    delivered: number;
    failed: number;
    total: number;
    percentage: number;
  }
): void => {
  emitToOrganization(organizationId, SocketEvents.CAMPAIGN_PROGRESS, {
    campaignId,
    progress,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Emit webhook received (for debugging/monitoring)
 */
export const emitWebhookReceived = (
  organizationId: string,
  webhookType: string,
  data: any
): void => {
  emitToOrganization(organizationId, SocketEvents.WEBHOOK_RECEIVED, {
    type: webhookType,
    data,
    timestamp: new Date().toISOString(),
  });
};

// ============================================
// EXPORTS
// ============================================

export { io };