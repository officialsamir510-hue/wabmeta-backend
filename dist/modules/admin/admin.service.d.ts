import { Prisma } from '@prisma/client';
export declare class AdminService {
    login(input: {
        email: string;
        password: string;
    }): Promise<{
        admin: {
            id: string;
            email: string;
            name: string;
            role: string;
        };
        token: string;
    }>;
    createAdmin(input: {
        email: string;
        password: string;
        name: string;
        role?: string;
    }): Promise<{
        id: string;
        email: string;
        name: string;
        role: string;
        isActive: boolean;
    }>;
    updateAdmin(id: string, input: any): Promise<{
        id: string;
        email: string;
        name: string;
        role: string;
        isActive: boolean;
    }>;
    getAdmins(): Promise<{
        id: string;
        email: string;
        name: string;
        role: string;
        isActive: boolean;
        lastLoginAt: Date | null;
    }[]>;
    deleteAdmin(id: string): Promise<{
        message: string;
    }>;
    getDashboardStats(): Promise<{
        users: {
            total: number;
            active: number;
        };
        organizations: {
            total: number;
        };
        contacts: {
            total: number;
        };
        messages: {
            total: number;
        };
    }>;
    getUsers(query: {
        page?: number;
        limit?: number;
        search?: string;
        status?: string;
        sortBy?: string;
        sortOrder?: string;
    }): Promise<{
        users: {
            id: string;
            email: string;
            firstName: string;
            lastName: string | null;
            status: import(".prisma/client").$Enums.UserStatus;
            emailVerified: boolean;
            createdAt: Date;
            organizations: {
                id: string;
                name: string;
                role: import(".prisma/client").$Enums.UserRole;
            }[];
        }[];
        total: number;
    }>;
    getUserById(id: string): Promise<{
        id: string;
        email: string;
        firstName: string;
        lastName: string | null;
        status: import(".prisma/client").$Enums.UserStatus;
        organizations: {
            id: string;
            name: string;
            role: import(".prisma/client").$Enums.UserRole;
        }[];
    }>;
    updateUser(id: string, input: any): Promise<{
        id: string;
        email: string;
        firstName: string;
        lastName: string | null;
        status: import(".prisma/client").$Enums.UserStatus;
    }>;
    deleteUser(id: string): Promise<{
        message: string;
    }>;
    suspendUser(id: string): Promise<{
        id: string;
        email: string;
        firstName: string;
        lastName: string | null;
        status: import(".prisma/client").$Enums.UserStatus;
    }>;
    activateUser(id: string): Promise<{
        id: string;
        email: string;
        firstName: string;
        lastName: string | null;
        status: import(".prisma/client").$Enums.UserStatus;
    }>;
    getOrganizations(query: {
        page?: number;
        limit?: number;
        search?: string;
        planType?: string;
        sortBy?: string;
        sortOrder?: string;
    }): Promise<{
        organizations: {
            id: string;
            name: string;
            slug: string;
            planType: import(".prisma/client").$Enums.PlanType;
            owner: {
                email: string;
                id: string;
                firstName: string;
            };
            memberCount: number;
            contactCount: number;
            createdAt: Date;
        }[];
        total: number;
    }>;
    getOrganizationById(id: string): Promise<{
        id: string;
        name: string;
        slug: string;
        planType: import(".prisma/client").$Enums.PlanType;
        owner: {
            email: string;
            id: string;
            firstName: string;
        };
        memberCount: number;
        contactCount: number;
    }>;
    updateOrganization(id: string, input: any): Promise<{
        id: string;
        name: string;
        slug: string;
        planType: import(".prisma/client").$Enums.PlanType;
    }>;
    deleteOrganization(id: string): Promise<{
        message: string;
    }>;
    updateSubscription(id: string, input: any): Promise<{
        id: string;
        name: string;
        slug: string;
        planType: import(".prisma/client").$Enums.PlanType;
        owner: {
            email: string;
            id: string;
            firstName: string;
        };
        memberCount: number;
        contactCount: number;
    }>;
    getPlans(): Promise<{
        id: string;
        name: string;
        type: import(".prisma/client").$Enums.PlanType;
        description: string | null;
        monthlyPrice: number;
        yearlyPrice: number;
        maxContacts: number;
        maxMessages: number;
        maxTeamMembers: number;
        features: string[];
        isActive: boolean;
    }[]>;
    createPlan(input: any): Promise<{
        id: string;
        name: string;
        type: import(".prisma/client").$Enums.PlanType;
        monthlyPrice: number;
        yearlyPrice: number;
        maxContacts: number;
        maxMessages: number;
        isActive: boolean;
    }>;
    updatePlan(id: string, input: any): Promise<{
        id: string;
        name: string;
        type: import(".prisma/client").$Enums.PlanType;
        isActive: boolean;
    }>;
    getActivityLogs(query: {
        page?: number;
        limit?: number;
        action?: string;
        userId?: string;
        organizationId?: string;
        startDate?: string;
        endDate?: string;
    }): Promise<{
        logs: {
            id: string;
            action: string;
            entity: string | null;
            entityId: string | null;
            userId: string | null;
            userEmail: string;
            organizationId: string | null;
            organizationName: string;
            metadata: Prisma.JsonValue;
            ipAddress: string | null;
            createdAt: Date;
        }[];
        total: number;
    }>;
    getSystemSettings(): {
        maintenanceMode: boolean;
        registrationEnabled: boolean;
        defaultPlan: string;
        maxOrganizationsPerUser: number;
        lastUpdated: Date;
    };
    updateSystemSettings(input: any): {
        maintenanceMode: boolean;
        registrationEnabled: boolean;
        defaultPlan: string;
        maxOrganizationsPerUser: number;
        lastUpdated: Date;
    };
}
export declare const adminService: AdminService;
//# sourceMappingURL=admin.service.d.ts.map