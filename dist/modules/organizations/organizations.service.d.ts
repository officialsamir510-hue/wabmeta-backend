import { UserRole } from '@prisma/client';
import { CreateOrganizationInput, UpdateOrganizationInput, OrganizationResponse, OrganizationWithMembers, OrganizationStats } from './organizations.types';
export declare class OrganizationsService {
    create(userId: string, input: CreateOrganizationInput): Promise<OrganizationResponse>;
    getById(organizationId: string, userId: string): Promise<OrganizationWithMembers>;
    getUserOrganizations(userId: string): Promise<OrganizationResponse[]>;
    update(organizationId: string, userId: string, input: UpdateOrganizationInput): Promise<OrganizationResponse>;
    inviteMember(organizationId: string, userId: string, email: string, role: UserRole): Promise<{
        message: string;
    }>;
    updateMemberRole(organizationId: string, userId: string, memberId: string, role: UserRole): Promise<{
        message: string;
    }>;
    removeMember(organizationId: string, userId: string, memberId: string): Promise<{
        message: string;
    }>;
    leaveOrganization(organizationId: string, userId: string): Promise<{
        message: string;
    }>;
    transferOwnership(organizationId: string, userId: string, newOwnerId: string, password: string): Promise<{
        message: string;
    }>;
    getStats(organizationId: string, userId: string): Promise<OrganizationStats>;
    delete(organizationId: string, userId: string, password: string): Promise<{
        message: string;
    }>;
}
export declare const organizationsService: OrganizationsService;
//# sourceMappingURL=organizations.service.d.ts.map