// src/modules/chatbot/chatbot.types.ts

import { Chatbot, ChatbotStatus } from '@prisma/client';

// ============================================
// FLOW BUILDER TYPES (ReactFlow Compatible)
// ============================================

export interface FlowNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: NodeData;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  data?: EdgeData;
}

export interface FlowData {
  nodes: FlowNode[];
  edges: FlowEdge[];
  viewport?: { x: number; y: number; zoom: number };
}

export type NodeType =
  | 'trigger'
  | 'message'
  | 'question'
  | 'condition'
  | 'action'
  | 'delay'
  | 'api'
  | 'assign'
  | 'tag'
  | 'end';

export interface NodeData {
  label: string;
  // Trigger node
  triggerType?: 'keyword' | 'first_message' | 'all_messages' | 'button_click';
  keywords?: string[];
  // Message node
  messageType?: 'text' | 'image' | 'video' | 'document' | 'buttons' | 'list';
  text?: string;
  mediaUrl?: string;
  buttons?: { id: string; title: string }[];
  listSections?: { title?: string; rows: { id: string; title: string; description?: string }[] }[];
  listButtonText?: string;
  // Question node
  questionText?: string;
  variableName?: string;
  validationType?: 'text' | 'number' | 'email' | 'phone' | 'date' | 'options';
  options?: string[];
  errorMessage?: string;
  // Condition node
  conditionType?: 'variable' | 'contact_field' | 'tag' | 'time';
  conditionVariable?: string;
  conditionOperator?: 'equals' | 'not_equals' | 'contains' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty';
  conditionValue?: string;
  // Action node
  actionType?: 'subscribe' | 'unsubscribe' | 'add_tag' | 'remove_tag' | 'update_contact' | 'notify_agent';
  actionValue?: string;
  // Delay node
  delayDuration?: number; // in seconds
  // API node
  apiUrl?: string;
  apiMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  apiHeaders?: Record<string, string>;
  apiBody?: string;
  apiResponseVariable?: string;
  // Assign node
  assignTo?: 'user' | 'team' | 'round_robin';
  assignUserId?: string;
  // Tag node
  tagAction?: 'add' | 'remove';
  tagNames?: string[];
}

export interface EdgeData {
  condition?: string;
  buttonId?: string;
  optionValue?: string;
}

// ============================================
// REQUEST TYPES
// ============================================

export interface CreateChatbotInput {
  name: string;
  description?: string;
  triggerKeywords?: string[];
  isDefault?: boolean;
  welcomeMessage?: string;
  fallbackMessage?: string;
  flowData?: FlowData;
}

export interface UpdateChatbotInput {
  name?: string;
  description?: string;
  triggerKeywords?: string[];
  isDefault?: boolean;
  welcomeMessage?: string;
  fallbackMessage?: string;
  flowData?: FlowData;
  status?: ChatbotStatus;
}

export interface ChatbotsQueryInput {
  page?: number;
  limit?: number;
  search?: string;
  status?: ChatbotStatus;
  sortBy?: 'createdAt' | 'name' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface TestChatbotInput {
  message: string;
  contactPhone?: string;
  sessionData?: Record<string, any>;
}

// ============================================
// RESPONSE TYPES
// ============================================

export interface ChatbotResponse {
  id: string;
  name: string;
  description: string | null;
  triggerKeywords: string[];
  isDefault: boolean;
  welcomeMessage: string | null;
  fallbackMessage: string | null;
  flowData: FlowData;
  status: ChatbotStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatbotsListResponse {
  chatbots: ChatbotResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ChatbotStats {
  total: number;
  active: number;
  draft: number;
  paused: number;
  totalConversations: number;
  messagesHandled: number;
}

export interface TestChatbotResponse {
  messages: {
    type: 'text' | 'image' | 'video' | 'document' | 'buttons' | 'list'; 
    content: string;
    buttons?: { id: string; title: string }[];
    listSections?: any[];
  }[];
  nextNodeId?: string;
  sessionData: Record<string, any>;
  ended: boolean;
}

// ============================================
// SESSION TYPES
// ============================================

export interface ChatbotSession {
  chatbotId: string;
  contactId: string;
  currentNodeId: string;
  variables: Record<string, any>;
  lastInteraction: Date;
  isActive: boolean;
}

// ============================================
// ENGINE TYPES
// ============================================

export interface ExecutionContext {
  organizationId: string;
  contactId: string;
  contactPhone: string;
  contactName: string;
  incomingMessage: string;
  session: ChatbotSession;
  variables: Record<string, any>;
}

export interface ExecutionResult {
  messages: OutgoingMessage[];
  nextNodeId: string | null;
  variables: Record<string, any>;
  ended: boolean;
  waitingForInput: boolean;
  error?: string;
}

export interface OutgoingMessage {
  type: 'text' | 'image' | 'video' | 'document' | 'buttons' | 'list';
  content?: string;
  mediaUrl?: string;
  buttons?: { id: string; title: string }[];
  listSections?: { title?: string; rows: { id: string; title: string; description?: string }[] }[];
  listButtonText?: string;
}