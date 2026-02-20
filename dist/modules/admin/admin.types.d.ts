export interface ActivityLogResponse {
    id: string;
    action: string;
    entity: string | null;
    entityId: string | null;
    userId: string | null;
    userEmail: string;
    organizationId: string | null;
    organizationName: string;
    metadata: any;
    ipAddress: string | null;
    createdAt: Date;
}
export interface CreatePlanInput {
    name: string;
    slug?: string;
    type: string;
    description?: string;
    monthlyPrice: number;
    yearlyPrice: number;
    maxWhatsAppAccounts?: number;
    maxContacts?: number;
    maxMessages?: number;
    maxMessagesPerMonth?: number;
    maxCampaigns?: number;
    maxCampaignsPerMonth?: number;
    maxTeamMembers?: number;
    maxTemplates?: number;
    maxChatbots?: number;
    maxAutomations?: number;
    maxApiCalls?: number;
    features?: string[];
    isActive?: boolean;
}
export interface DashboardStats {
    users: {
        total: number;
        active: number;
        recent: number;
        growthRate: string;
    };
    organizations: {
        total: number;
        active: number;
        recent: number;
        growthRate: string;
    };
    contacts: {
        total: number;
    };
    messages: {
        total: number;
        recent: number;
    };
    campaigns: {
        total: number;
        active: number;
    };
    templates: {
        total: number;
        approved: number;
    };
    revenue: {
        mrr: number;
        arr: number;
        activeSubscriptions: number;
    };
    planDistribution: Record<string, number>;
    totalRevenue: number;
    totalSubscriptions: number;
    revenueChart: Array<{
        date: string;
        revenue: number;
        subscriptions: number;
    }>;
    userGrowthChart: Array<{
        date: string;
        users: number;
        organizations: number;
    }>;
    messageActivityChart: Array<{
        date: string;
        messages: number;
        campaigns: number;
    }>;
    recentActivity: any[];
}
//# sourceMappingURL=admin.types.d.ts.map