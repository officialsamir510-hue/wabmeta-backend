export declare class DashboardService {
    getDashboardStats(userId: string, organizationId: string): Promise<{
        messagesSent: number;
        messagesDelivered: number;
        messagesRead: number;
        messagesFailed: number;
        deliveryRate: number;
        readRate: number;
        totalContacts: number;
        totalCampaigns: number;
        totalTemplates: number;
        totalConversations: number;
    }>;
    getQuickStats(organizationId: string): Promise<{
        contactsToday: number;
        messagesToday: number;
        campaignsActive: number;
        unreadConversations: number;
    }>;
    getChartData(organizationId: string, days?: number): Promise<{
        messages: {
            date: string;
            count: any;
        }[];
        contacts: {
            date: string;
            count: any;
        }[];
    }>;
    getWidgetsData(organizationId: string, days?: number): Promise<{
        contacts: {
            total: number;
            new: number;
            growthRate: number;
        };
        messages: {
            total: number;
            sent: number;
            delivered: number;
            read: number;
            failed: number;
            deliveryRate: number;
            readRate: number;
            failureRate: number;
        };
        campaigns: {
            active: number;
            completed: number;
            total: number;
        };
        templates: {
            total: number;
            approved: number;
            pending: number;
        };
        conversations: {
            unread: number;
        };
        whatsapp: {
            connectedAccounts: number;
        };
        period: {
            days: number;
            startDate: string;
            endDate: string;
        };
    }>;
    getRecentActivity(organizationId: string, limit?: number): Promise<({
        type: "message";
        id: string;
        title: string;
        description: string;
        contact: string;
        timestamp: Date;
        status: import(".prisma/client").$Enums.MessageStatus;
    } | {
        type: "campaign";
        id: string;
        title: string;
        description: string;
        timestamp: Date;
        status: import(".prisma/client").$Enums.CampaignStatus;
    } | {
        type: "contact";
        id: string;
        title: string;
        description: string;
        timestamp: Date;
    })[]>;
    private getMessageStats;
    private formatChartData;
}
export declare const dashboardService: DashboardService;
//# sourceMappingURL=dashboard.service.d.ts.map