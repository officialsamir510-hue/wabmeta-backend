// ✅ REPLACE: src/modules/chatbot/chatbot.engine.ts

import prisma from '../../config/database';
import { whatsappService } from '../whatsapp/whatsapp.service';
import { webhookEvents } from '../webhooks/webhook.service';

interface FlowNode {
  id: string;
  type: 'start' | 'message' | 'button' | 'condition' | 'delay' | 'action' | 'end';
  data: {
    message?: string;
    buttons?: { id: string; text: string; nextNodeId?: string }[];
    condition?: { variable: string; operator: string; value: string };
    delay?: number; // milliseconds
    action?: { type: string; params: any };
    nextNodeId?: string;
  };
  position?: { x: number; y: number };
}

interface FlowData {
  nodes: FlowNode[];
  edges: { source: string; target: string; sourceHandle?: string }[];
}

interface SessionData {
  currentNodeId: string;
  variables: Record<string, any>;
  startedAt: Date;
  lastActivityAt: Date;
}

// In-memory session store (use Redis in production)
const sessions = new Map<string, SessionData>();

export class ChatbotEngine {
  // ==========================================
  // PROCESS INCOMING MESSAGE
  // ==========================================
  async processMessage(
    conversationId: string,
    organizationId: string,
    messageContent: string,
    senderPhone: string,
    isNewConversation: boolean
  ): Promise<void> {
    try {
      console.log(`🤖 Chatbot processing: "${messageContent}" from ${senderPhone}`);

      // 1. Find active chatbot
      const chatbot = await this.findActiveChatbot(organizationId, messageContent, isNewConversation);
      
      if (!chatbot) {
        console.log('🤖 No active chatbot found for this trigger');
        return;
      }

      console.log(`🤖 Using chatbot: ${chatbot.name}`);

      // 2. Get or create session
      const sessionKey = `${conversationId}:${chatbot.id}`;
      let session = sessions.get(sessionKey);

      const flowData = chatbot.flowData as unknown as FlowData;
      
      if (!flowData || !flowData.nodes || flowData.nodes.length === 0) {
        console.log('🤖 Chatbot has no flow configured');
        return;
      }

      // 3. Handle based on session state
      if (!session || isNewConversation) {
        // New conversation - start from beginning
        session = await this.startNewSession(sessionKey, flowData);
      } else {
        // Existing session - process user input
        session = await this.processUserInput(session, messageContent, flowData);
      }

      // 4. Execute current node
      await this.executeNode(
        session,
        flowData,
        conversationId,
        organizationId,
        senderPhone,
        chatbot.id
      );

      // 5. Save session
      sessions.set(sessionKey, session);

    } catch (error) {
      console.error('🤖 Chatbot engine error:', error);
    }
  }

  // ==========================================
  // FIND ACTIVE CHATBOT
  // ==========================================
  private async findActiveChatbot(
    organizationId: string,
    messageContent: string,
    isNewConversation: boolean
  ) {
    // Check for keyword triggers
    const chatbots = await prisma.chatbot.findMany({
      where: {
        organizationId,
        status: 'ACTIVE',
      },
    });

    for (const chatbot of chatbots) {
      // Check keyword triggers
      const keywords = (chatbot.triggerKeywords as string[]) || [];
      const lowerMessage = messageContent.toLowerCase().trim();

      for (const keyword of keywords) {
        if (lowerMessage === keyword.toLowerCase() || 
            lowerMessage.includes(keyword.toLowerCase())) {
          return chatbot;
        }
      }

      // Check for default chatbot on new conversations
      if (isNewConversation && chatbot.isDefault) {
        return chatbot;
      }
    }

    // Return default chatbot if exists
    return chatbots.find(c => c.isDefault);
  }

  // ==========================================
  // START NEW SESSION
  // ==========================================
  private async startNewSession(
    sessionKey: string,
    flowData: FlowData
  ): Promise<SessionData> {
    // Find start node
    const startNode = flowData.nodes.find(n => n.type === 'start');
    const firstNodeId = startNode?.data?.nextNodeId || flowData.nodes[0]?.id;

    const session: SessionData = {
      currentNodeId: firstNodeId,
      variables: {},
      startedAt: new Date(),
      lastActivityAt: new Date(),
    };

    console.log(`🤖 Started new session, first node: ${firstNodeId}`);
    return session;
  }

  // ==========================================
  // PROCESS USER INPUT
  // ==========================================
  private async processUserInput(
    session: SessionData,
    messageContent: string,
    flowData: FlowData
  ): Promise<SessionData> {
    const currentNode = flowData.nodes.find(n => n.id === session.currentNodeId);
    
    if (!currentNode) {
      return session;
    }

    // If current node has buttons, check if user clicked one
    if (currentNode.type === 'button' && currentNode.data.buttons) {
      const clickedButton = currentNode.data.buttons.find(
        b => b.text.toLowerCase() === messageContent.toLowerCase() ||
             b.id === messageContent
      );

      if (clickedButton && clickedButton.nextNodeId) {
        session.currentNodeId = clickedButton.nextNodeId;
        console.log(`🤖 Button clicked: ${clickedButton.text}, moving to: ${clickedButton.nextNodeId}`);
      }
    }

    // Store user input in variables
    session.variables['lastInput'] = messageContent;
    session.variables['lastInputAt'] = new Date().toISOString();
    session.lastActivityAt = new Date();

    return session;
  }

  // ==========================================
  // EXECUTE NODE
  // ==========================================
  private async executeNode(
    session: SessionData,
    flowData: FlowData,
    conversationId: string,
    organizationId: string,
    senderPhone: string,
    chatbotId: string
  ): Promise<void> {
    const node = flowData.nodes.find(n => n.id === session.currentNodeId);

    if (!node) {
      console.log('🤖 Node not found:', session.currentNodeId);
      return;
    }

    console.log(`🤖 Executing node: ${node.type} (${node.id})`);

    switch (node.type) {
      case 'start':
        // Move to next node
        if (node.data.nextNodeId) {
          session.currentNodeId = node.data.nextNodeId;
          await this.executeNode(session, flowData, conversationId, organizationId, senderPhone, chatbotId);
        }
        break;

      case 'message':
        // Send text message
        if (node.data.message) {
          await this.sendMessage(
            organizationId,
            senderPhone,
            this.replaceVariables(node.data.message, session.variables),
            conversationId
          );
        }
        
        // Move to next node automatically
        if (node.data.nextNodeId) {
          session.currentNodeId = node.data.nextNodeId;
          // Small delay before next node for snappier response
          await this.delay(200);
          await this.executeNode(session, flowData, conversationId, organizationId, senderPhone, chatbotId);
        }
        break;

      case 'button':
        // Send interactive button message
        if (node.data.message && node.data.buttons) {
          await this.sendButtonMessage(
            organizationId,
            senderPhone,
            this.replaceVariables(node.data.message, session.variables),
            node.data.buttons,
            conversationId
          );
        }
        // Wait for user response - don't auto-advance
        break;

      case 'condition':
        // Evaluate condition
        const conditionMet = this.evaluateCondition(node.data.condition, session.variables);
        
        // Find next node based on condition
        const edge = flowData.edges.find(e => 
          e.source === node.id && 
          e.sourceHandle === (conditionMet ? 'true' : 'false')
        );
        
        if (edge) {
          session.currentNodeId = edge.target;
          await this.executeNode(session, flowData, conversationId, organizationId, senderPhone, chatbotId);
        } else if (node.data.nextNodeId) {
          session.currentNodeId = node.data.nextNodeId;
          await this.executeNode(session, flowData, conversationId, organizationId, senderPhone, chatbotId);
        }
        break;

      case 'delay':
        // Wait for specified time
        const delayMs = node.data.delay || 1000;
        await this.delay(delayMs);
        
        if (node.data.nextNodeId) {
          session.currentNodeId = node.data.nextNodeId;
          await this.executeNode(session, flowData, conversationId, organizationId, senderPhone, chatbotId);
        }
        break;

      case 'action':
        // Execute action (API call, tag contact, etc.)
        await this.executeAction(node.data.action, session, organizationId, senderPhone);
        
        if (node.data.nextNodeId) {
          session.currentNodeId = node.data.nextNodeId;
          await this.executeNode(session, flowData, conversationId, organizationId, senderPhone, chatbotId);
        }
        break;

      case 'end':
        // End conversation - clear session
        console.log('🤖 Flow ended');
        break;

      default:
        console.log(`🤖 Unknown node type: ${node.type}`);
    }
  }

  // ==========================================
  // SEND MESSAGE
  // ==========================================
  private async sendMessage(
    organizationId: string,
    to: string,
    message: string,
    conversationId: string
  ): Promise<void> {
    try {
      // Get default WhatsApp account
      const account = await prisma.whatsAppAccount.findFirst({
        where: { organizationId, status: 'CONNECTED' },
        orderBy: { isDefault: 'desc' },
      });

      if (!account) {
        console.error('🤖 No WhatsApp account connected');
        return;
      }

      await whatsappService.sendTextMessage(
        account.id,
        to,
        message,
        conversationId,
        organizationId
      );

      console.log(`🤖 Sent message: "${message.substring(0, 50)}..."`);
    } catch (error) {
      console.error('🤖 Failed to send message:', error);
    }
  }

  // ==========================================
  // SEND BUTTON MESSAGE
  // ==========================================
  private async sendButtonMessage(
    organizationId: string,
    to: string,
    message: string,
    buttons: { id: string; text: string }[],
    conversationId: string
  ): Promise<void> {
    try {
      const account = await prisma.whatsAppAccount.findFirst({
        where: { organizationId, status: 'CONNECTED' },
        orderBy: { isDefault: 'desc' },
      });

      if (!account) return;

      // Send as interactive message
      await whatsappService.sendMessage({
        accountId: account.id,
        to,
        type: 'interactive',
        content: {
          interactive: {
            type: 'button',
            body: { text: message },
            action: {
              buttons: buttons.slice(0, 3).map(b => ({
                type: 'reply',
                reply: { id: b.id, title: b.text.substring(0, 20) },
              })),
            },
          },
        },
        conversationId,
        organizationId,
      });

      console.log(`🤖 Sent button message with ${buttons.length} buttons`);
    } catch (error) {
      console.error('🤖 Failed to send button message:', error);
    }
  }

  // ==========================================
  // EVALUATE CONDITION
  // ==========================================
  private evaluateCondition(
    condition: { variable: string; operator: string; value: string } | undefined,
    variables: Record<string, any>
  ): boolean {
    if (!condition) return true;

    const { variable, operator, value } = condition;
    const varValue = variables[variable];

    switch (operator) {
      case 'equals':
        return String(varValue).toLowerCase() === String(value).toLowerCase();
      case 'contains':
        return String(varValue).toLowerCase().includes(String(value).toLowerCase());
      case 'startsWith':
        return String(varValue).toLowerCase().startsWith(String(value).toLowerCase());
      case 'endsWith':
        return String(varValue).toLowerCase().endsWith(String(value).toLowerCase());
      case 'greaterThan':
        return Number(varValue) > Number(value);
      case 'lessThan':
        return Number(varValue) < Number(value);
      case 'exists':
        return varValue !== undefined && varValue !== null && varValue !== '';
      default:
        return false;
    }
  }

  // ==========================================
  // EXECUTE ACTION
  // ==========================================
  private async executeAction(
    action: { type: string; params: any } | undefined,
    session: SessionData,
    organizationId: string,
    phone: string
  ): Promise<void> {
    if (!action) return;

    switch (action.type) {
      case 'tagContact':
        // Add tag to contact
        await prisma.contact.updateMany({
          where: { organizationId, phone: { contains: phone.replace(/\D/g, '').slice(-10) } },
          data: { tags: { push: action.params.tag } },
        });
        console.log(`🤖 Added tag: ${action.params.tag}`);
        break;

      case 'setVariable':
        session.variables[action.params.name] = action.params.value;
        break;

      case 'webhook':
        // Call external webhook
        try {
          await fetch(action.params.url, {
            method: action.params.method || 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone,
              organizationId,
              variables: session.variables,
              ...action.params.data,
            }),
          });
          console.log(`🤖 Webhook called: ${action.params.url}`);
        } catch (e) {
          console.error('🤖 Webhook failed:', e);
        }
        break;

      case 'createLead':
        // Create CRM lead
        await (prisma.lead.create as any)({
          data: {
            organizationId,
            title: action.params?.title || 'Chatbot Lead',
            source: 'chatbot',
            contact: {
              connect: {
                organizationId_phone: {
                  organizationId,
                  phone: phone.startsWith('+') ? phone : `+${phone}`,
                },
              },
            },
          },
        }).catch(() => console.log('🤖 Could not create lead'));
        break;

      default:
        console.log(`🤖 Unknown action type: ${action.type}`);
    }
  }

  // ==========================================
  // HELPERS
  // ==========================================
  private replaceVariables(text: string, variables: Record<string, any>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return variables[key] !== undefined ? String(variables[key]) : `{{${key}}}`;
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Clear expired sessions (call periodically)
  clearExpiredSessions(maxAgeMs: number = 30 * 60 * 1000): void {
    const now = Date.now();
    for (const [key, session] of sessions.entries()) {
      if (now - session.lastActivityAt.getTime() > maxAgeMs) {
        sessions.delete(key);
      }
    }
  }
}

export const chatbotEngine = new ChatbotEngine();

// Clean up expired sessions every 5 minutes
setInterval(() => {
  chatbotEngine.clearExpiredSessions();
}, 5 * 60 * 1000);