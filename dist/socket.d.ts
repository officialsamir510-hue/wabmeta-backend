import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
export declare const initializeSocket: (server: HttpServer) => Server<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any>;
export declare const getIO: () => Server;
export declare const broadcastToOrganization: (organizationId: string, event: string, data: any) => void;
export declare const broadcastToUser: (userId: string, event: string, data: any) => void;
export declare const broadcastToConversation: (conversationId: string, event: string, data: any) => void;
export declare const broadcastToCampaign: (campaignId: string, event: string, data: any) => void;
export declare const getActiveConnections: () => Promise<number>;
export declare const getOrganizationConnections: (organizationId: string) => Promise<number>;
export declare const getCampaignConnections: (campaignId: string) => Promise<number>;
declare const _default: {
    initializeSocket: (server: HttpServer) => Server<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any>;
    getIO: () => Server;
    broadcastToOrganization: (organizationId: string, event: string, data: any) => void;
    broadcastToUser: (userId: string, event: string, data: any) => void;
    broadcastToConversation: (conversationId: string, event: string, data: any) => void;
    broadcastToCampaign: (campaignId: string, event: string, data: any) => void;
    getActiveConnections: () => Promise<number>;
    getOrganizationConnections: (organizationId: string) => Promise<number>;
    getCampaignConnections: (campaignId: string) => Promise<number>;
};
export default _default;
//# sourceMappingURL=socket.d.ts.map