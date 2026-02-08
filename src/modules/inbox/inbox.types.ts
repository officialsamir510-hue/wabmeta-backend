// src/modules/inbox/inbox.types.ts

import { Message, MessageType, MessageDirection, MessageStatus, Conversation } from '@prisma/client';

// ============================================
// REQUEST TYPES
// ============================================

export interface ConversationsQueryInput {
  page?: number;
  limit?: number;
  search?: string;
  isArchived?: boolean;
  isRead?: boolean;
  assignedTo?: string;
  labels?: string[];
  sortBy?: 'lastMessageAt' | 'createdAt' | 'unreadCount';
  sortOrder?: 'asc' | 'desc';
}

export interface MessagesQueryInput {
  page?: number;
  limit?: number;
  before?: string; // Message ID for cursor pagination
  after?: string;
}

export interface SendMessageInput {
  conversationId: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'interactive';
  content?: string;
  mediaUrl?: string;
  mediaType?: string;
  filename?: string;
  replyToMessageId?: string;
  // Interactive message options
  interactive?: {
    type: 'button' | 'list';
    buttons?: { id: string; title: string }[];
    sections?: { title?: string; rows: { id: string; title: string; description?: string }[] }[];
    buttonText?: string;
  };
}

export interface UpdateConversationInput {
  isArchived?: boolean;
  isRead?: boolean;
  labels?: string[];
  assignedTo?: string | null;
}

export interface QuickReplyInput {
  name: string;
  content: string;
  shortcut?: string;
}

// ============================================
// RESPONSE TYPES
// ============================================

export interface ConversationResponse {
  id: string;
  contact: {
    id: string;
    phone: string;
    fullPhone: string;
    firstName: string | null;
    lastName: string | null;
    fullName: string;
    avatar: string | null;
    email: string | null;
    tags: string[];
  };
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  isArchived: boolean;
  isRead: boolean;
  unreadCount: number;
  assignedTo: string | null;
  assignedUser?: {
    id: string;
    firstName: string;
    lastName: string | null;
    avatar: string | null;
  };
  labels: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationDetailResponse extends ConversationResponse {
  messages: MessageResponse[];
  totalMessages: number;
}

export interface MessageResponse {
  id: string;
  wamId: string | null;
  waMessageId: string | null;
  direction: MessageDirection;
  type: MessageType;
  content: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  mediaMimeType: string | null;
  templateName: string | null;
  status: MessageStatus;
  sentAt: Date | null;
  deliveredAt: Date | null;
  readAt: Date | null;
  failedAt: Date | null;
  failureReason: string | null;
  replyToMessageId: string | null;
  replyToMessage?: MessageResponse | null;
  createdAt: Date;
}

export interface ConversationsListResponse {
  conversations: ConversationResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    unreadTotal: number;
  };
}

export interface InboxStats {
  totalConversations: number;
  unreadConversations: number;
  archivedConversations: number;
  assignedToMe: number;
  unassigned: number;
  todayMessages: number;
  responseRate: number;
  averageResponseTime: number; // in minutes
}

export interface QuickReplyResponse {
  id: string;
  name: string;
  content: string;
  shortcut: string | null;
  usageCount: number;
  createdAt: Date;
}

// ============================================
// SOCKET EVENTS
// ============================================

export interface SocketEvents {
  // Client to Server
  'join:organization': (organizationId: string) => void;
  'join:conversation': (conversationId: string) => void;
  'leave:conversation': (conversationId: string) => void;
  'typing:start': (conversationId: string) => void;
  'typing:stop': (conversationId: string) => void;
  'message:read': (conversationId: string) => void;

  // Server to Client
  'conversation:new': (conversation: ConversationResponse) => void;
  'conversation:updated': (conversation: ConversationResponse) => void;
  'message:new': (message: MessageResponse & { conversationId: string }) => void;
  'message:status': (data: { messageId: string; status: MessageStatus }) => void;
  'user:typing': (data: { conversationId: string; userId: string; isTyping: boolean }) => void;
}