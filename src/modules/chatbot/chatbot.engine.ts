// src/modules/chatbot/chatbot.engine.ts

import prisma from '../../config/database';
import {
  FlowData,
  FlowNode,
  FlowEdge,
  NodeData,
  ExecutionContext,
  ExecutionResult,
  OutgoingMessage,
  ChatbotSession,
} from './chatbot.types';

// ============================================
// CHATBOT ENGINE CLASS
// ============================================

export class ChatbotEngine {
  private flowData: FlowData;
  private nodes: Map<string, FlowNode>;
  private edges: FlowEdge[];

  constructor(flowData: FlowData) {
    this.flowData = flowData;
    this.nodes = new Map(flowData.nodes.map((n) => [n.id, n]));
    this.edges = flowData.edges;
  }

  // ==========================================
  // FIND TRIGGER NODE
  // ==========================================
  findTriggerNode(message: string, isFirstMessage: boolean = false): FlowNode | null {
    for (const node of this.flowData.nodes) {
      if (node.type !== 'trigger') continue;

      const data = node.data;

      // Check trigger type
      switch (data.triggerType) {
        case 'first_message':
          if (isFirstMessage) return node;
          break;

        case 'all_messages':
          return node;

        case 'keyword':
          if (data.keywords && data.keywords.length > 0) {
            const lowerMessage = message.toLowerCase();
            for (const keyword of data.keywords) {
              if (lowerMessage.includes(keyword.toLowerCase())) {
                return node;
              }
            }
          }
          break;

        case 'button_click':
          // Will be handled separately
          break;
      }
    }

    return null;
  }

  // ==========================================
  // GET NEXT NODE
  // ==========================================
  getNextNode(currentNodeId: string, context?: { buttonId?: string; optionValue?: string }): FlowNode | null {
    const outgoingEdges = this.edges.filter((e) => e.source === currentNodeId);

    if (outgoingEdges.length === 0) return null;

    // If there's only one edge, follow it
    if (outgoingEdges.length === 1) {
      return this.nodes.get(outgoingEdges[0].target) || null;
    }

    // Multiple edges - check conditions
    for (const edge of outgoingEdges) {
      if (context?.buttonId && edge.data?.buttonId === context.buttonId) {
        return this.nodes.get(edge.target) || null;
      }
      if (context?.optionValue && edge.data?.optionValue === context.optionValue) {
        return this.nodes.get(edge.target) || null;
      }
    }

    // Return first edge as default
    return this.nodes.get(outgoingEdges[0].target) || null;
  }

  // ==========================================
  // EXECUTE NODE
  // ==========================================
  async executeNode(
    node: FlowNode,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    const messages: OutgoingMessage[] = [];
    let nextNodeId: string | null = null;
    let waitingForInput = false;
    let ended = false;
    const variables = { ...context.variables };

    try {
      switch (node.type) {
        case 'trigger':
          // Just pass through to next node
          const nextAfterTrigger = this.getNextNode(node.id);
          nextNodeId = nextAfterTrigger?.id || null;
          break;

        case 'message':
          const msgResult = this.executeMessageNode(node.data);
          messages.push(...msgResult);
          const nextAfterMessage = this.getNextNode(node.id);
          nextNodeId = nextAfterMessage?.id || null;
          break;

        case 'question':
          const questionResult = this.executeQuestionNode(node.data, context.incomingMessage, variables);
          if (questionResult.valid) {
            variables[node.data.variableName || 'answer'] = questionResult.value;
            const nextAfterQuestion = this.getNextNode(node.id, { optionValue: questionResult.value });
            nextNodeId = nextAfterQuestion?.id || null;
          } else {
            // Send error message and wait for valid input
            messages.push({
              type: 'text',
              content: node.data.errorMessage || 'Invalid input. Please try again.',
            });
            nextNodeId = node.id; // Stay on same node
            waitingForInput = true;
          }
          break;

        case 'condition':
          const conditionResult = this.evaluateCondition(node.data, variables, context);
          const conditionEdges = this.edges.filter((e) => e.source === node.id);
          
          // Find matching edge based on condition result
          for (const edge of conditionEdges) {
            if (edge.sourceHandle === (conditionResult ? 'true' : 'false')) {
              nextNodeId = edge.target;
              break;
            }
          }
          
          if (!nextNodeId && conditionEdges.length > 0) {
            nextNodeId = conditionEdges[0].target;
          }
          break;

        case 'action':
          await this.executeAction(node.data, context);
          const nextAfterAction = this.getNextNode(node.id);
          nextNodeId = nextAfterAction?.id || null;
          break;

        case 'delay':
          // In real implementation, this would be handled by a job queue
          // For now, we just proceed to next node
          const nextAfterDelay = this.getNextNode(node.id);
          nextNodeId = nextAfterDelay?.id || null;
          break;

        case 'api':
          const apiResult = await this.executeApiCall(node.data);
          if (node.data.apiResponseVariable) {
            variables[node.data.apiResponseVariable] = apiResult;
          }
          const nextAfterApi = this.getNextNode(node.id);
          nextNodeId = nextAfterApi?.id || null;
          break;

        case 'assign':
          await this.assignConversation(node.data, context);
          const nextAfterAssign = this.getNextNode(node.id);
          nextNodeId = nextAfterAssign?.id || null;
          break;

        case 'tag':
          await this.handleTags(node.data, context);
          const nextAfterTag = this.getNextNode(node.id);
          nextNodeId = nextAfterTag?.id || null;
          break;

        case 'end':
          ended = true;
          break;
      }
    } catch (error: any) {
      console.error('Node execution error:', error);
      return {
        messages: [],
        nextNodeId: null,
        variables,
        ended: true,
        waitingForInput: false,
        error: error.message,
      };
    }

    return {
      messages,
      nextNodeId,
      variables,
      ended,
      waitingForInput,
    };
  }

  // ==========================================
  // EXECUTE MESSAGE NODE
  // ==========================================
  private executeMessageNode(data: NodeData): OutgoingMessage[] {
    const messages: OutgoingMessage[] = [];

    switch (data.messageType) {
      case 'text':
        if (data.text) {
          messages.push({ type: 'text', content: data.text });
        }
        break;

      case 'image':
        messages.push({
          type: 'image',
          mediaUrl: data.mediaUrl,
          content: data.text,
        });
        break;

      case 'video':
        messages.push({
          type: 'video',
          mediaUrl: data.mediaUrl,
          content: data.text,
        });
        break;

      case 'document':
        messages.push({
          type: 'document',
          mediaUrl: data.mediaUrl,
          content: data.text,
        });
        break;

      case 'buttons':
        messages.push({
          type: 'buttons',
          content: data.text,
          buttons: data.buttons,
        });
        break;

      case 'list':
        messages.push({
          type: 'list',
          content: data.text,
          listSections: data.listSections,
          listButtonText: data.listButtonText,
        });
        break;
    }

    return messages;
  }

  // ==========================================
  // EXECUTE QUESTION NODE
  // ==========================================
  private executeQuestionNode(
    data: NodeData,
    userInput: string,
    variables: Record<string, any>
  ): { valid: boolean; value: any } {
    // If this is first time on this node (no input yet)
    if (!userInput) {
      return { valid: false, value: null };
    }

    const input = userInput.trim();

    switch (data.validationType) {
      case 'text':
        return { valid: input.length > 0, value: input };

      case 'number':
        const num = parseFloat(input);
        return { valid: !isNaN(num), value: num };

      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return { valid: emailRegex.test(input), value: input };

      case 'phone':
        const phoneRegex = /^\+?[1-9]\d{9,14}$/;
        const cleanPhone = input.replace(/\D/g, '');
        return { valid: phoneRegex.test(cleanPhone), value: cleanPhone };

      case 'date':
        const date = new Date(input);
        return { valid: !isNaN(date.getTime()), value: input };

      case 'options':
        if (data.options && data.options.length > 0) {
          const lowerInput = input.toLowerCase();
          const matchedOption = data.options.find(
            (opt) => opt.toLowerCase() === lowerInput
          );
          return { valid: !!matchedOption, value: matchedOption || input };
        }
        return { valid: true, value: input };

      default:
        return { valid: true, value: input };
    }
  }

  // ==========================================
  // EVALUATE CONDITION
  // ==========================================
  private evaluateCondition(
    data: NodeData,
    variables: Record<string, any>,
    context: ExecutionContext
  ): boolean {
    let value: any;

    switch (data.conditionType) {
      case 'variable':
        value = variables[data.conditionVariable || ''];
        break;

      case 'contact_field':
        value = context[data.conditionVariable as keyof ExecutionContext];
        break;

      case 'tag':
        // Would need to fetch contact tags
        value = '';
        break;

      case 'time':
        value = new Date().getHours();
        break;

      default:
        value = variables[data.conditionVariable || ''];
    }

    const compareValue = data.conditionValue || '';

    switch (data.conditionOperator) {
      case 'equals':
        return String(value) === compareValue;

      case 'not_equals':
        return String(value) !== compareValue;

      case 'contains':
        return String(value).toLowerCase().includes(compareValue.toLowerCase());

      case 'starts_with':
        return String(value).toLowerCase().startsWith(compareValue.toLowerCase());

      case 'ends_with':
        return String(value).toLowerCase().endsWith(compareValue.toLowerCase());

      case 'greater_than':
        return Number(value) > Number(compareValue);

      case 'less_than':
        return Number(value) < Number(compareValue);

      case 'is_empty':
        return !value || String(value).trim() === '';

      case 'is_not_empty':
        return !!value && String(value).trim() !== '';

      default:
        return false;
    }
  }

  // ==========================================
  // EXECUTE ACTION
  // ==========================================
  private async executeAction(data: NodeData, context: ExecutionContext): Promise<void> {
    switch (data.actionType) {
      case 'add_tag':
        if (data.actionValue) {
          await prisma.contact.update({
            where: { id: context.contactId },
            data: {
              tags: {
                push: data.actionValue,
              },
            },
          });
        }
        break;

      case 'remove_tag':
        if (data.actionValue) {
          const contact = await prisma.contact.findUnique({
            where: { id: context.contactId },
          });
          if (contact) {
            await prisma.contact.update({
              where: { id: context.contactId },
              data: {
                tags: contact.tags.filter((t) => t !== data.actionValue),
              },
            });
          }
        }
        break;

      case 'update_contact':
        // Parse action value as JSON for field updates
        try {
          const updates = JSON.parse(data.actionValue || '{}');
          await prisma.contact.update({
            where: { id: context.contactId },
            data: updates,
          });
        } catch (e) {
          console.error('Failed to parse contact update:', e);
        }
        break;

      case 'notify_agent':
        // Would trigger a notification to agents
        console.log('Agent notification triggered:', data.actionValue);
        break;

      case 'subscribe':
        await prisma.contact.update({
          where: { id: context.contactId },
          data: { status: 'ACTIVE' },
        });
        break;

      case 'unsubscribe':
        await prisma.contact.update({
          where: { id: context.contactId },
          data: { status: 'UNSUBSCRIBED' },
        });
        break;
    }
  }

  // ==========================================
  // EXECUTE API CALL
  // ==========================================
  private async executeApiCall(data: NodeData): Promise<any> {
    if (!data.apiUrl) return null;

    try {
      const response = await fetch(data.apiUrl, {
        method: data.apiMethod || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...data.apiHeaders,
        },
        body: data.apiMethod !== 'GET' && data.apiBody ? data.apiBody : undefined,
      });

      return await response.json();
    } catch (error) {
      console.error('API call failed:', error);
      return null;
    }
  }

  // ==========================================
  // ASSIGN CONVERSATION
  // ==========================================
  private async assignConversation(data: NodeData, context: ExecutionContext): Promise<void> {
    const conversation = await prisma.conversation.findFirst({
      where: {
        organizationId: context.organizationId,
        contactId: context.contactId,
      },
    });

    if (!conversation) return;

    let assignToUserId: string | null = null;

    switch (data.assignTo) {
      case 'user':
        assignToUserId = data.assignUserId || null;
        break;

      case 'round_robin':
        // Get team members and assign in round-robin fashion
        const members = await prisma.organizationMember.findMany({
          where: { organizationId: context.organizationId },
          select: { userId: true },
        });
        if (members.length > 0) {
          const randomIndex = Math.floor(Math.random() * members.length);
          assignToUserId = members[randomIndex].userId;
        }
        break;
    }

    if (assignToUserId) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { assignedTo: assignToUserId },
      });
    }
  }

  // ==========================================
  // HANDLE TAGS
  // ==========================================
  private async handleTags(data: NodeData, context: ExecutionContext): Promise<void> {
    if (!data.tagNames || data.tagNames.length === 0) return;

    const contact = await prisma.contact.findUnique({
      where: { id: context.contactId },
    });

    if (!contact) return;

    let newTags: string[];

    if (data.tagAction === 'add') {
      newTags = [...new Set([...contact.tags, ...data.tagNames])];
    } else {
      newTags = contact.tags.filter((t) => !data.tagNames?.includes(t));
    }

    await prisma.contact.update({
      where: { id: context.contactId },
      data: { tags: newTags },
    });
  }

  // ==========================================
  // REPLACE VARIABLES IN TEXT
  // ==========================================
  replaceVariables(text: string, variables: Record<string, any>, context: ExecutionContext): string {
    return text.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      // Check user variables first
      if (variables[varName] !== undefined) {
        return String(variables[varName]);
      }

      // Check context
      switch (varName) {
        case 'contact_name':
          return context.contactName;
        case 'contact_phone':
          return context.contactPhone;
        default:
          return match;
      }
    });
  }
}