import { Template, TemplateStatus, TemplateCategory } from '@prisma/client';
export declare const TEMPLATE_HEADER_TYPES: readonly ["NONE", "TEXT", "IMAGE", "VIDEO", "DOCUMENT"];
export type TemplateHeaderType = typeof TEMPLATE_HEADER_TYPES[number];
export declare const TEMPLATE_BUTTON_TYPES: readonly ["NONE", "CALL_TO_ACTION", "QUICK_REPLY"];
export type TemplateButtonType = typeof TEMPLATE_BUTTON_TYPES[number];
export declare const TEMPLATE_CTA_TYPES: readonly ["URL", "PHONE_NUMBER"];
export type TemplateCTAType = typeof TEMPLATE_CTA_TYPES[number];
export interface QuickReplyButton {
    type: 'QUICK_REPLY';
    text: string;
}
export interface URLButton {
    type: 'URL';
    text: string;
    url: string;
}
export interface PhoneButton {
    type: 'PHONE_NUMBER';
    text: string;
    phoneNumber: string;
}
export type TemplateButton = QuickReplyButton | URLButton | PhoneButton;
export interface TemplateVariable {
    index: number;
    type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
    example?: string;
}
export interface CreateTemplateInput {
    name: string;
    language: string;
    category: TemplateCategory;
    headerType?: TemplateHeaderType;
    headerContent?: string;
    bodyText: string;
    footerText?: string;
    buttons?: TemplateButton[];
    variables?: TemplateVariable[];
}
export interface UpdateTemplateInput {
    name?: string;
    language?: string;
    category?: TemplateCategory;
    headerType?: TemplateHeaderType;
    headerContent?: string;
    bodyText?: string;
    footerText?: string;
    buttons?: TemplateButton[];
    variables?: TemplateVariable[];
}
export interface TemplatesQueryInput {
    page?: number;
    limit?: number;
    search?: string;
    status?: TemplateStatus;
    category?: TemplateCategory;
    language?: string;
    sortBy?: 'createdAt' | 'name' | 'status';
    sortOrder?: 'asc' | 'desc';
}
export interface SubmitTemplateInput {
    templateId: string;
    whatsappAccountId: string;
}
export interface SyncTemplatesInput {
    whatsappAccountId: string;
}
export interface TemplateResponse {
    id: string;
    name: string;
    language: string;
    category: TemplateCategory;
    headerType: string | null;
    headerContent: string | null;
    bodyText: string;
    footerText: string | null;
    buttons: TemplateButton[];
    variables: TemplateVariable[];
    status: TemplateStatus;
    metaTemplateId: string | null;
    rejectionReason: string | null;
    createdAt: Date;
    updatedAt: Date;
}
export interface TemplatesListResponse {
    templates: TemplateResponse[];
    meta: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
export interface TemplateStats {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    byCategory: {
        marketing: number;
        utility: number;
        authentication: number;
    };
}
export interface TemplatePreview {
    header?: string;
    body: string;
    footer?: string;
    buttons?: {
        type: string;
        text: string;
    }[];
}
export interface MetaTemplateComponent {
    type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
    format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
    text?: string;
    buttons?: {
        type: 'URL' | 'PHONE_NUMBER' | 'QUICK_REPLY';
        text: string;
        url?: string;
        phone_number?: string;
    }[];
    example?: {
        header_text?: string[];
        body_text?: string[][];
        header_handle?: string[];
    };
}
export interface MetaTemplatePayload {
    name: string;
    language: string;
    category: string;
    components: MetaTemplateComponent[];
}
export type SafeTemplate = Omit<Template, 'organizationId'>;
//# sourceMappingURL=templates.types.d.ts.map