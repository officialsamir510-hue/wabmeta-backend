// src/modules/chatbot/chatbot.engine.ts

import prisma from '../../config/database';
import { chatbotService } from './chatbot.service';
import { whatsappService } from '../whatsapp/whatsapp.service';
import { FlowData, FlowNode, ChatbotSession } from './chatbot.types';

// In-memory session store (use Redis in production)
const sessions = new Map<string, ChatbotSession>();

export class ChatbotEngine {
  // ==========================================
  // PROCESS INCOMING MESSAGE
  // ==========================================
  async processMessage(
    conversationId: string,
    organizationId: string,
    messageText: string,
    senderPhone: string,
    isNewConversation: boolean
  ): Promise<{ handled: boolean; responses: string[] }> {
    try {
      console.log(`🤖 Chatbot processing message for conversation ${conversationId}`);

      // Get or create session
      let session = sessions.get(conversationId);
      const responses: string[] = [];

      // Find matching chatbot
      const chatbot = await chatbotService.findMatchingChatbot(
        organizationId,
        messageText,
        isNewConversation && !session
      );

      if (!chatbot) {
        console.log('   No matching chatbot found');
        return { handled: false, responses: [] };
      }

      console.log(`   Matched chatbot: ${chatbot.name}`);

      const flowData = chatbot.flowData;

      // If no session exists, create one and start from beginning
      if (!session) {
        session = {
          conversationId,
          chatbotId: chatbot.id,
          currentNodeId: 'start',
          variables: {},
          lastInteractionAt: new Date(),
          messageCount: 0,
        };
        sessions.set(conversationId, session);

        // Send welcome message if it's a new conversation
        if (isNewConversation && chatbot.welcomeMessage) {
          responses.push(chatbot.welcomeMessage);
        }
      }

      // Update session
      session.lastInteractionAt = new Date();
      session.messageCount++;

      // Process flow
      const flowResponses = await this.processFlow(
        flowData,
        session,
        messageText,
        chatbot
      );

      responses.push(...flowResponses);

      // If no responses from flow, send fallback
      if (responses.length === 0 && chatbot.fallbackMessage) {
        responses.push(chatbot.fallbackMessage);
      }

      // Send responses via WhatsApp
      if (responses.length > 0) {
        await this.sendResponses(organizationId, senderPhone, responses);
      }

      return { handled: responses.length > 0, responses };
    } catch (error: any) {
      console.error('Chatbot engine error:', error);
      return { handled: false, responses: [] };
    }
  }

  // ==========================================
  // PROCESS FLOW
  // ==========================================
  private async processFlow(
    flowData: FlowData,
    session: ChatbotSession,
    userMessage: string,
    chatbot: any
  ): Promise<string[]> {
    const responses: string[] = [];
    const { nodes, edges } = flowData;

    if (!nodes || nodes.length === 0) {
      return responses;
    }

    // Find current node
    let currentNode = nodes.find(n => n.id === session.currentNodeId);

    // If no current node or it's start, find the first message node
    if (!currentNode || currentNode.type === 'start') {
      const startNode = nodes.find(n => n.type === 'start');
      if (startNode) {
        // Find edge from start node
        const nextEdge = edges.find(e => e.source === startNode.id);
        if (nextEdge) {
          currentNode = nodes.find(n => n.id === nextEdge.target);
        }
      }
    }

    // Process nodes until we hit a stopping point
    let processedNodes = 0;
    const maxNodes = 10; // Prevent infinite loops

    while (currentNode && processedNodes < maxNodes) {
      processedNodes++;

      console.log(`   Processing node: ${currentNode.type} (${currentNode.id})`);

      switch (currentNode.type) {
        case 'message':
          // Send the message
          if (currentNode.data.message) {
            const processedMessage = this.processVariables(
              currentNode.data.message,
              session.variables
            );
            responses.push(processedMessage);
          }
          // Move to next node
          currentNode = this.getNextNode(currentNode.id, edges, nodes);
          break;

        case 'button':
          // Send message with buttons (interactive)
          if (currentNode.data.message) {
            const buttonMessage = this.formatButtonMessage(currentNode);
            responses.push(buttonMessage);
          }
          // Wait for user response - update session and return
          session.currentNodeId = currentNode.id;
          return responses;

        case 'condition':
          // Evaluate condition and choose path
          const conditionResult = this.evaluateCondition(
            currentNode.data.condition!,
            userMessage,
            session.variables
          );

          // Find the correct edge based on condition
          const conditionEdge = edges.find(e => 
            e.source === currentNode!.id && 
            (conditionResult ? e.sourceHandle === 'yes' : e.sourceHandle === 'no')
          );

          if (conditionEdge) {
            currentNode = nodes.find(n => n.id === conditionEdge.target);
          } else {
            currentNode = this.getNextNode(currentNode.id, edges, nodes);
          }
          break;

        case 'delay':
          // In production, implement actual delay with job queue
          // For now, just continue
          currentNode = this.getNextNode(currentNode.id, edges, nodes);
          break;

        case 'action':
          // Execute action
          await this.executeAction(currentNode, session);
          currentNode = this.getNextNode(currentNode.id, edges, nodes);
          break;

        default:
          currentNode = this.getNextNode(currentNode.id, edges, nodes);
      }
    }

    // Update session with final node
    if (currentNode) {
      session.currentNodeId = currentNode.id;
    } else {
      // Flow completed, reset session
      sessions.delete(session.conversationId);
    }

    return responses;
  }

  // ==========================================
  // GET NEXT NODE
  // ==========================================
  private getNextNode(
    currentNodeId: string,
    edges: FlowData['edges'],
    nodes: FlowData['nodes']
  ): FlowNode | undefined {
    const edge = edges.find(e => e.source === currentNodeId);
    if (!edge) return undefined;
    return nodes.find(n => n.id === edge.target);
  }

  // ==========================================
  // EVALUATE CONDITION
  // ==========================================
  private evaluateCondition(
    condition: { type: string; value: string },
    userMessage: string,
    variables: Record<string, any>
  ): boolean {
    const { type, value } = condition;
    const lowerMessage = userMessage.toLowerCase().trim();
    const lowerValue = value.toLowerCase().trim();

    switch (type) {
      case 'keyword':
      case 'contains':
        return lowerMessage.includes(lowerValue);

      case 'exact':
        return lowerMessage === lowerValue;

      case 'regex':
        try {
          const regex = new RegExp(value, 'i');
          return regex.test(userMessage);
        } catch {
          return false;
        }

      default:
        return false;
    }
  }

  // ==========================================
  // EXECUTE ACTION
  // ==========================================
  private async executeAction(
    node: FlowNode,
    session: ChatbotSession
  ): Promise<void> {
    const { action } = node.data;
    if (!action) return;

    switch (action.type) {
      case 'tag':
        // Add tag to contact
        console.log(`   Action: Adding tag "${action.value}"`);
        // TODO: Implement contact tagging
        break;

      case 'assign':
        // Assign conversation to team member
        console.log(`   Action: Assigning to "${action.value}"`);
        // TODO: Implement conversation assignment
        break;

      case 'variable':
        // Set variable
        const [varName, varValue] = action.value.split('=');
        if (varName && varValue) {
          session.variables[varName.trim()] = varValue.trim();
        }
        break;

      case 'webhook':
        // Send webhook
        console.log(`   Action: Sending webhook to "${action.value}"`);
        // TODO: Implement webhook sending
        break;
    }
  }

  // ==========================================
  // FORMAT BUTTON MESSAGE
  // ==========================================
  private formatButtonMessage(node: FlowNode): string {
    const { message, buttons } = node.data;
    let formatted = message || '';

    if (buttons && buttons.length > 0) {
      formatted += '\n\n';
      buttons.forEach((btn, index) => {
        formatted += `${index + 1}. ${btn.text}\n`;
      });
      formatted += '\nReply with the number of your choice.';
    }

    return formatted;
  }

  // ==========================================
  // PROCESS VARIABLES IN MESSAGE
  // ==========================================
  private processVariables(
    message: string,
    variables: Record<string, any>
  ): string {
    let processed = message;

    // Replace {{variable}} with values
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      processed = processed.replace(regex, String(value));
    }

    return processed;
  }

  // ==========================================
  // SEND RESPONSES VIA WHATSAPP
  // ==========================================
  private async sendResponses(
    organizationId: string,
    recipientPhone: string,
    responses: string[]
  ): Promise<void> {
    try {
      // Get default WhatsApp account
      const waAccount = await prisma.whatsAppAccount.findFirst({
        where: {
          organizationId,
          status: 'CONNECTED',
          isDefault: true,
        },
      });

      if (!waAccount) {
        console.error('No WhatsApp account found for chatbot responses');
        return;
      }

      // Send each response with a small delay
      for (let i = 0; i < responses.length; i++) {
        const response = responses[i];

        // Add small delay between messages
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        await whatsappService.sendTextMessage(
          organizationId,
          waAccount.id,
          recipientPhone,
          response
        );

        console.log(`   📤 Sent chatbot response: "${response.substring(0, 50)}..."`);
      }
    } catch (error: any) {
      console.error('Error sending chatbot responses:', error.message);
    }
  }

  // ==========================================
  // HANDLE BUTTON RESPONSE
  // ==========================================
  async handleButtonResponse(
    conversationId: string,
    buttonPayload: string
  ): Promise<void> {
    const session = sessions.get(conversationId);
    if (!session) return;

    // Update session based on button clicked
    // Find the node and update currentNodeId
    console.log(`   Button response received: ${buttonPayload}`);
  }

  // ==========================================
  // CLEAR SESSION
  // ==========================================
  clearSession(conversationId: string): void {
    sessions.delete(conversationId);
  }

  // ==========================================
  // GET SESSION
  // ==========================================
  getSession(conversationId: string): ChatbotSession | undefined {
    return sessions.get(conversationId);
  }
}

export const chatbotEngine = new ChatbotEngine();