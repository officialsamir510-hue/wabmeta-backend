import { ChatbotStatus } from '@prisma/client';
import { ChatbotInput, ChatbotResponse, ChatbotStats } from './chatbot.types';
export declare class ChatbotService {
    getAll(organizationId: string, params: {
        page?: number;
        limit?: number;
        status?: ChatbotStatus;
        search?: string;
    }): Promise<{
        chatbots: ChatbotResponse[];
        total: number;
        page: number;
        limit: number;
    }>;
    getById(organizationId: string, chatbotId: string): Promise<ChatbotResponse>;
    create(organizationId: string, userId: string, input: ChatbotInput): Promise<ChatbotResponse>;
    update(organizationId: string, chatbotId: string, input: Partial<ChatbotInput>): Promise<ChatbotResponse>;
    delete(organizationId: string, chatbotId: string): Promise<void>;
    activate(organizationId: string, chatbotId: string): Promise<ChatbotResponse>;
    deactivate(organizationId: string, chatbotId: string): Promise<ChatbotResponse>;
    duplicate(organizationId: string, userId: string, chatbotId: string): Promise<ChatbotResponse>;
    getStats(organizationId: string, chatbotId: string): Promise<ChatbotStats>;
    getActiveChatbots(organizationId: string): Promise<ChatbotResponse[]>;
    findMatchingChatbot(organizationId: string, messageText: string, isNewConversation: boolean): Promise<ChatbotResponse | null>;
    private formatChatbot;
}
export declare const chatbotService: ChatbotService;
//# sourceMappingURL=chatbot.service.d.ts.map