import { TemplateStatus } from '@prisma/client';
import { CreateTemplateInput, UpdateTemplateInput, TemplatesQueryInput, TemplateResponse, TemplatesListResponse, TemplateStats, TemplatePreview, TemplateButton } from './templates.types';
export declare class TemplatesService {
    validateTemplate(input: CreateTemplateInput): {
        valid: boolean;
        errors: string[];
    };
    create(organizationId: string, input: CreateTemplateInput): Promise<TemplateResponse>;
    duplicate(organizationId: string, templateId: string, newName: string): Promise<TemplateResponse>;
    getApprovedTemplates(organizationId: string): Promise<TemplateResponse[]>;
    getLanguages(organizationId: string): Promise<{
        language: string;
        count: number;
    }[]>;
    getList(organizationId: string, query: TemplatesQueryInput): Promise<TemplatesListResponse>;
    getById(organizationId: string, templateId: string): Promise<TemplateResponse>;
    update(organizationId: string, templateId: string, input: UpdateTemplateInput): Promise<TemplateResponse>;
    delete(organizationId: string, templateId: string): Promise<{
        message: string;
    }>;
    getStats(organizationId: string): Promise<TemplateStats>;
    preview(bodyText: string, variables?: Record<string, string>, headerType?: string, headerContent?: string, footerText?: string, buttons?: TemplateButton[]): Promise<TemplatePreview>;
    submitToMeta(organizationId: string, templateId: string, whatsappAccountId?: string): Promise<{
        message: string;
        metaTemplateId?: string;
    }>;
    syncFromMeta(organizationId: string, whatsappAccountId?: string): Promise<{
        message: string;
        synced: number;
    }>;
    updateStatus(metaTemplateId: string, status: TemplateStatus, rejectionReason?: string): Promise<void>;
}
export declare const templatesService: TemplatesService;
//# sourceMappingURL=templates.service.d.ts.map