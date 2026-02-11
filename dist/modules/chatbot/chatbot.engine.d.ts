import { ChatbotSession } from './chatbot.types';
export declare class ChatbotEngine {
    processMessage(conversationId: string, organizationId: string, messageText: string, senderPhone: string, isNewConversation: boolean): Promise<{
        handled: boolean;
        responses: string[];
    }>;
    private processFlow;
    private getNextNode;
    private evaluateCondition;
    private executeAction;
    private formatButtonMessage;
    private processVariables;
    private sendResponses;
    handleButtonResponse(conversationId: string, buttonPayload: string): Promise<void>;
    clearSession(conversationId: string): void;
    getSession(conversationId: string): ChatbotSession | undefined;
}
export declare const chatbotEngine: ChatbotEngine;
//# sourceMappingURL=chatbot.engine.d.ts.map