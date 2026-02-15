"use strict";
// src/modules/templates/templates.service.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.templatesService = exports.TemplatesService = void 0;
const database_1 = __importDefault(require("../../config/database"));
const errorHandler_1 = require("../../middleware/errorHandler");
const whatsapp_api_1 = require("../whatsapp/whatsapp.api");
const meta_service_1 = require("../meta/meta.service");
// ============================================
// HELPERS
// ============================================
const formatTemplate = (template) => ({
    id: template.id,
    name: template.name,
    language: template.language,
    category: template.category,
    headerType: template.headerType,
    headerContent: template.headerContent,
    bodyText: template.bodyText,
    footerText: template.footerText,
    buttons: template.buttons || [],
    variables: template.variables || [],
    status: template.status,
    metaTemplateId: template.metaTemplateId,
    rejectionReason: template.rejectionReason,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
    whatsappAccount: undefined,
    wabaId: null,
    whatsappAccountId: null,
});
const extractVariables = (text) => {
    const regex = /\{\{(\d+)\}\}/g;
    const variables = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
        variables.push(parseInt(match[1], 10));
    }
    return [...new Set(variables)].sort((a, b) => a - b);
};
const replaceVariables = (text, values) => {
    return text.replace(/\{\{(\d+)\}\}/g, (match, index) => values[index] || match);
};
const toJsonValue = (value) => JSON.parse(JSON.stringify(value));
const toMetaLanguage = (lang) => {
    if (!lang)
        return 'en_US';
    if (lang.includes('_'))
        return lang;
    const languageMap = {
        'en': 'en_US', 'hi': 'hi_IN', 'es': 'es_ES', 'pt': 'pt_BR',
        'ar': 'ar_SA', 'fr': 'fr_FR', 'de': 'de_DE', 'it': 'it_IT',
        'ru': 'ru_RU', 'zh': 'zh_CN',
    };
    return languageMap[lang] || 'en_US';
};
const normalizeHeaderType = (t) => {
    const headerType = String(t || 'NONE').toUpperCase();
    return ['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType) ? headerType : 'NONE';
};
const buildMetaTemplatePayload = (t) => {
    const components = [];
    const headerType = normalizeHeaderType(t.headerType);
    if (headerType && headerType !== 'NONE') {
        if (headerType === 'TEXT' && t.headerContent) {
            const headerVars = extractVariables(t.headerContent);
            const headerComp = {
                type: 'HEADER',
                format: 'TEXT',
                text: t.headerContent
            };
            if (headerVars.length > 0) {
                headerComp.example = {
                    header_text: headerVars.map((i) => `Example${i}`)
                };
            }
            components.push(headerComp);
        }
        else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType)) {
            throw new errorHandler_1.AppError(`HeaderType ${headerType} requires media upload. Use TEXT header for now.`, 400);
        }
    }
    const bodyVars = extractVariables(t.bodyText);
    const bodyComp = { type: 'BODY', text: t.bodyText };
    if (bodyVars.length > 0) {
        bodyComp.example = {
            body_text: [bodyVars.map((i) => `Example${i}`)]
        };
    }
    components.push(bodyComp);
    if (t.footerText) {
        components.push({ type: 'FOOTER', text: t.footerText });
    }
    if (t.buttons && t.buttons.length > 0) {
        const buttons = t.buttons.slice(0, 3).map((b) => {
            const type = String(b.type || '').toUpperCase();
            if (type.includes('URL')) {
                if (!b.url)
                    throw new errorHandler_1.AppError('URL button requires url field', 400);
                return { type: 'URL', text: b.text, url: b.url };
            }
            if (type.includes('PHONE')) {
                if (!b.phoneNumber)
                    throw new errorHandler_1.AppError('PHONE button requires phoneNumber field', 400);
                return { type: 'PHONE_NUMBER', text: b.text, phone_number: b.phoneNumber };
            }
            return { type: 'QUICK_REPLY', text: b.text };
        });
        components.push({ type: 'BUTTONS', buttons });
    }
    return {
        name: t.name,
        language: toMetaLanguage(t.language),
        category: String(t.category || 'UTILITY').toUpperCase(),
        components,
    };
};
/**
 * ✅ Get WhatsApp Account with decrypted token
 */
const getWhatsAppAccountWithToken = async (organizationId, whatsappAccountId) => {
    try {
        console.log('🔍 Getting WhatsApp account:', { organizationId, whatsappAccountId });
        // Build query
        const where = {
            organizationId,
            status: 'CONNECTED',
        };
        if (whatsappAccountId) {
            where.id = whatsappAccountId;
        }
        else {
            // Get default or first connected
            where.isDefault = true;
        }
        let waAccount = await database_1.default.whatsAppAccount.findFirst({
            where,
            orderBy: [
                { isDefault: 'desc' },
                { createdAt: 'desc' }
            ],
        });
        // If no default, get any connected account
        if (!waAccount && !whatsappAccountId) {
            waAccount = await database_1.default.whatsAppAccount.findFirst({
                where: {
                    organizationId,
                    status: 'CONNECTED',
                },
                orderBy: { createdAt: 'desc' },
            });
        }
        if (!waAccount) {
            // Check if ANY account exists
            const anyAccount = await database_1.default.whatsAppAccount.findFirst({
                where: { organizationId },
                select: { id: true, status: true, phoneNumber: true },
            });
            if (!anyAccount) {
                throw new errorHandler_1.AppError('No WhatsApp account found. Please connect your WhatsApp Business account in Settings → WhatsApp.', 400);
            }
            else if (anyAccount.status === 'DISCONNECTED') {
                throw new errorHandler_1.AppError(`WhatsApp account (${anyAccount.phoneNumber}) is disconnected. Please reconnect in Settings → WhatsApp.`, 400);
            }
            else {
                throw new errorHandler_1.AppError(`WhatsApp account (${anyAccount.phoneNumber}) status is ${anyAccount.status}. Please check Settings → WhatsApp.`, 400);
            }
        }
        if (!waAccount.wabaId) {
            throw new errorHandler_1.AppError('WhatsApp Business Account ID missing. Please reconnect your account in Settings → WhatsApp.', 400);
        }
        if (!waAccount.accessToken) {
            throw new errorHandler_1.AppError('WhatsApp access token missing. Please reconnect your account in Settings → WhatsApp.', 400);
        }
        // Get decrypted token
        const accountWithToken = await meta_service_1.metaService.getAccountWithToken(waAccount.id);
        if (!accountWithToken) {
            throw new errorHandler_1.AppError('Failed to decrypt WhatsApp access token. Please reconnect your account in Settings → WhatsApp.', 400);
        }
        console.log('✅ Using WhatsApp Account:', {
            id: waAccount.id,
            phone: waAccount.phoneNumber,
            wabaId: waAccount.wabaId,
            isDefault: waAccount.isDefault,
        });
        return {
            account: waAccount,
            accessToken: accountWithToken.accessToken,
            wabaId: waAccount.wabaId,
            phoneNumberId: waAccount.phoneNumberId,
        };
    }
    catch (error) {
        console.error('❌ Get WhatsApp account error:', error);
        if (error instanceof errorHandler_1.AppError) {
            throw error;
        }
        throw new errorHandler_1.AppError('Failed to get WhatsApp account: ' + error.message, 500);
    }
};
// ============================================
// SERVICE CLASS
// ============================================
class TemplatesService {
    validateTemplate(input) {
        const errors = [];
        if (!/^[a-z0-9_]+$/.test(input.name)) {
            errors.push('Template name must be lowercase with underscores only (a-z, 0-9, _)');
        }
        if (input.name.length < 1 || input.name.length > 512) {
            errors.push('Template name must be between 1 and 512 characters');
        }
        if (!input.bodyText || input.bodyText.trim().length === 0) {
            errors.push('Body text is required');
        }
        if (input.bodyText && input.bodyText.length > 1024) {
            errors.push('Body text exceeds 1024 characters');
        }
        const headerType = normalizeHeaderType(input.headerType);
        if (headerType === 'TEXT' && input.headerContent) {
            if (input.headerContent.length > 60) {
                errors.push('Header text exceeds 60 characters');
            }
        }
        if (input.footerText && input.footerText.length > 60) {
            errors.push('Footer text exceeds 60 characters');
        }
        if (input.buttons && input.buttons.length > 3) {
            errors.push('Maximum 3 buttons allowed');
        }
        const varsInBody = extractVariables(input.bodyText);
        for (let i = 0; i < varsInBody.length; i++) {
            if (varsInBody[i] !== i + 1) {
                errors.push(`Variables must be sequential starting from {{1}}. Found gap at {{${i + 1}}}`);
                break;
            }
        }
        return { valid: errors.length === 0, errors };
    }
    async create(organizationId, input) {
        const { name, language, category, headerType, headerContent, bodyText, footerText, buttons, variables, whatsappAccountId } = input;
        const validation = this.validateTemplate(input);
        if (!validation.valid) {
            throw new errorHandler_1.AppError(`Validation failed: ${validation.errors.join(', ')}`, 400);
        }
        // ✅ Get WhatsApp account to validate connection
        const waData = await getWhatsAppAccountWithToken(organizationId, whatsappAccountId);
        // Check duplicates
        const existing = await database_1.default.template.findFirst({
            where: {
                organizationId,
                name,
                language,
            },
        });
        if (existing) {
            throw new errorHandler_1.AppError('Template with this name and language already exists', 409);
        }
        const extractedVars = extractVariables(bodyText);
        const finalVariables = variables && variables.length > 0
            ? variables
            : extractedVars.map((index) => ({ index, type: 'text' }));
        // Create template
        const template = await database_1.default.template.create({
            data: {
                organizationId,
                name,
                language,
                category,
                headerType: headerType || null,
                headerContent: headerContent || null,
                bodyText,
                footerText: footerText || null,
                buttons: toJsonValue(buttons || []),
                variables: toJsonValue(finalVariables),
                status: 'PENDING',
                metaTemplateId: null,
                rejectionReason: null,
            },
        });
        console.log(`✅ Template created: ${template.id}`);
        // Submit to Meta
        try {
            const metaPayload = buildMetaTemplatePayload({
                name, language, category,
                headerType: headerType || null,
                headerContent: headerContent || null,
                bodyText, footerText: footerText || null,
                buttons: (buttons || []),
            });
            console.log('📤 Submitting template to Meta WABA:', waData.wabaId);
            const metaRes = await whatsapp_api_1.whatsappApi.createMessageTemplate(waData.wabaId, waData.accessToken, metaPayload);
            const metaTemplateId = metaRes?.id || metaRes?.template_id;
            if (metaTemplateId) {
                await database_1.default.template.update({
                    where: { id: template.id },
                    data: {
                        metaTemplateId: String(metaTemplateId),
                        status: 'PENDING',
                    },
                });
                console.log('✅ Meta template created:', metaTemplateId);
            }
        }
        catch (e) {
            const msg = String(e?.response?.data?.error?.message || e?.message || 'Meta submission failed');
            console.error('❌ Meta template create failed:', e?.response?.data || e.message);
            await database_1.default.template.update({
                where: { id: template.id },
                data: {
                    status: 'REJECTED',
                    rejectionReason: msg,
                },
            });
        }
        const latest = await database_1.default.template.findUnique({
            where: { id: template.id },
        });
        return formatTemplate(latest);
    }
    async getList(organizationId, query) {
        const { page = 1, limit = 20, search, status, category, language, sortBy = 'createdAt', sortOrder = 'desc', } = query;
        const skip = (page - 1) * limit;
        const where = { organizationId };
        if (search && search.trim()) {
            where.OR = [
                { name: { contains: search.trim(), mode: 'insensitive' } },
                { bodyText: { contains: search.trim(), mode: 'insensitive' } },
            ];
        }
        if (status)
            where.status = status;
        if (category)
            where.category = category;
        if (language)
            where.language = language;
        const [templates, total] = await Promise.all([
            database_1.default.template.findMany({
                where,
                skip,
                take: limit,
                orderBy: { [sortBy]: sortOrder },
            }),
            database_1.default.template.count({ where }),
        ]);
        console.log(`📋 Found ${templates.length} templates (total: ${total})`);
        return {
            templates: templates.map(formatTemplate),
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            },
        };
    }
    async getApprovedTemplates(organizationId, whatsappAccountId) {
        const where = {
            organizationId,
            status: 'APPROVED',
        };
        const templates = await database_1.default.template.findMany({
            where,
            orderBy: { name: 'asc' },
        });
        return templates.map(formatTemplate);
    }
    async syncFromMeta(organizationId, whatsappAccountId) {
        console.log('🔄 Syncing templates from Meta...');
        const waData = await getWhatsAppAccountWithToken(organizationId, whatsappAccountId);
        const metaTemplates = await whatsapp_api_1.whatsappApi.listMessageTemplates(waData.wabaId, waData.accessToken);
        console.log(`📥 Found ${metaTemplates.length} templates in Meta`);
        let synced = 0;
        for (const mt of metaTemplates) {
            try {
                const metaId = String(mt.id);
                const metaName = String(mt.name);
                const metaLang = String(mt.language);
                const metaStatusRaw = String(mt.status || 'PENDING').toUpperCase();
                const mappedStatus = metaStatusRaw === 'APPROVED' ? 'APPROVED' :
                    metaStatusRaw === 'REJECTED' ? 'REJECTED' : 'PENDING';
                const rejectionReason = mt.rejected_reason || mt.rejection_reason || null;
                const bodyComponent = mt.components?.find((c) => c.type === 'BODY');
                const headerComponent = mt.components?.find((c) => c.type === 'HEADER');
                const footerComponent = mt.components?.find((c) => c.type === 'FOOTER');
                const buttonsComponent = mt.components?.find((c) => c.type === 'BUTTONS');
                const existing = await database_1.default.template.findFirst({
                    where: {
                        organizationId,
                        name: metaName,
                        language: metaLang,
                    }
                });
                if (existing) {
                    await database_1.default.template.update({
                        where: { id: existing.id },
                        data: {
                            metaTemplateId: metaId,
                            status: mappedStatus,
                            rejectionReason,
                            category: (String(mt.category || 'UTILITY').toUpperCase()),
                        }
                    });
                }
                else {
                    await database_1.default.template.create({
                        data: {
                            organizationId,
                            name: metaName,
                            language: metaLang,
                            category: (String(mt.category || 'UTILITY').toUpperCase()),
                            bodyText: bodyComponent?.text || 'Imported from Meta',
                            headerType: headerComponent?.format || null,
                            headerContent: headerComponent?.text || null,
                            footerText: footerComponent?.text || null,
                            status: mappedStatus,
                            metaTemplateId: metaId,
                            buttons: toJsonValue(buttonsComponent?.buttons || []),
                            variables: toJsonValue([]),
                            rejectionReason,
                        },
                    });
                }
                synced++;
            }
            catch (err) {
                console.error(`Failed to sync template ${mt.name}:`, err.message);
            }
        }
        console.log(`✅ Synced ${synced} templates from Meta`);
        return { message: 'Templates synced from Meta', synced };
    }
    async getById(organizationId, templateId) {
        const template = await database_1.default.template.findFirst({
            where: { id: templateId, organizationId },
        });
        if (!template) {
            throw new errorHandler_1.AppError('Template not found', 404);
        }
        return formatTemplate(template);
    }
    async update(organizationId, templateId, input) {
        const existing = await database_1.default.template.findFirst({
            where: { id: templateId, organizationId }
        });
        if (!existing) {
            throw new errorHandler_1.AppError('Template not found', 404);
        }
        if (existing.status === 'APPROVED' && existing.metaTemplateId) {
            throw new errorHandler_1.AppError('Cannot modify approved templates. Create a new template instead.', 400);
        }
        let finalVariables = input.variables;
        if (input.bodyText) {
            const extracted = extractVariables(input.bodyText);
            if (!finalVariables || finalVariables.length === 0) {
                finalVariables = extracted.map((index) => ({ index, type: 'text' }));
            }
        }
        const updateData = {
            name: input.name,
            language: input.language,
            category: input.category,
            headerType: input.headerType,
            headerContent: input.headerContent,
            bodyText: input.bodyText,
            footerText: input.footerText,
        };
        if (input.buttons !== undefined)
            updateData.buttons = toJsonValue(input.buttons);
        if (finalVariables !== undefined)
            updateData.variables = toJsonValue(finalVariables);
        if (input.bodyText || input.headerContent) {
            updateData.status = 'PENDING';
        }
        const updated = await database_1.default.template.update({
            where: { id: templateId },
            data: updateData,
        });
        console.log(`✅ Template updated: ${templateId}`);
        return formatTemplate(updated);
    }
    async delete(organizationId, templateId) {
        const template = await database_1.default.template.findFirst({
            where: { id: templateId, organizationId }
        });
        if (!template) {
            throw new errorHandler_1.AppError('Template not found', 404);
        }
        await database_1.default.template.delete({ where: { id: templateId } });
        console.log(`✅ Template deleted: ${templateId}`);
        return { message: 'Template deleted successfully' };
    }
    async getStats(organizationId, whatsappAccountId) {
        try {
            const where = { organizationId };
            const [total, pending, approved, rejected, marketing, utility, authentication] = await Promise.all([
                database_1.default.template.count({ where }),
                database_1.default.template.count({ where: { ...where, status: 'PENDING' } }),
                database_1.default.template.count({ where: { ...where, status: 'APPROVED' } }),
                database_1.default.template.count({ where: { ...where, status: 'REJECTED' } }),
                database_1.default.template.count({ where: { ...where, category: 'MARKETING' } }),
                database_1.default.template.count({ where: { ...where, category: 'UTILITY' } }),
                database_1.default.template.count({ where: { ...where, category: 'AUTHENTICATION' } }),
            ]);
            return {
                total,
                pending,
                approved,
                rejected,
                byCategory: { marketing, utility, authentication },
            };
        }
        catch (error) {
            console.error('❌ Get template stats error:', error);
            return {
                total: 0,
                pending: 0,
                approved: 0,
                rejected: 0,
                byCategory: { marketing: 0, utility: 0, authentication: 0 },
            };
        }
    }
    async duplicate(organizationId, templateId, newName, targetWhatsappAccountId) {
        const original = await database_1.default.template.findFirst({
            where: { id: templateId, organizationId },
        });
        if (!original) {
            throw new errorHandler_1.AppError('Template not found', 404);
        }
        const dup = await database_1.default.template.findFirst({
            where: {
                organizationId,
                name: newName,
                language: original.language,
            },
        });
        if (dup) {
            throw new errorHandler_1.AppError('Template with this name already exists', 409);
        }
        const created = await database_1.default.template.create({
            data: {
                organizationId,
                name: newName,
                language: original.language,
                category: original.category,
                headerType: original.headerType,
                headerContent: original.headerContent,
                bodyText: original.bodyText,
                footerText: original.footerText,
                buttons: original.buttons || toJsonValue([]),
                variables: original.variables || toJsonValue([]),
                status: 'PENDING',
                metaTemplateId: null,
                rejectionReason: null,
            },
        });
        console.log(`📋 Template duplicated: ${templateId} -> ${created.id}`);
        return formatTemplate(created);
    }
    async preview(bodyText, variables = {}, headerType, headerContent, footerText, buttons) {
        const preview = {
            body: replaceVariables(bodyText, variables)
        };
        const normalizedHeaderType = normalizeHeaderType(headerType);
        if (normalizedHeaderType === 'TEXT' && headerContent) {
            preview.header = replaceVariables(headerContent, variables);
        }
        else if (normalizedHeaderType !== 'NONE') {
            preview.header = `[${normalizedHeaderType}]`;
        }
        if (footerText) {
            preview.footer = footerText;
        }
        if (buttons && buttons.length > 0) {
            preview.buttons = buttons.map((btn) => ({
                type: btn.type,
                text: btn.text
            }));
        }
        return preview;
    }
    async submitToMeta(organizationId, templateId, whatsappAccountId) {
        const template = await database_1.default.template.findFirst({
            where: { id: templateId, organizationId }
        });
        if (!template) {
            throw new errorHandler_1.AppError('Template not found', 404);
        }
        const waData = await getWhatsAppAccountWithToken(organizationId, whatsappAccountId);
        const metaPayload = buildMetaTemplatePayload({
            name: template.name,
            language: template.language,
            category: template.category,
            headerType: template.headerType,
            headerContent: template.headerContent,
            bodyText: template.bodyText,
            footerText: template.footerText,
            buttons: template.buttons || [],
        });
        console.log('📤 Submitting template to Meta:', { templateId, name: template.name });
        const metaRes = await whatsapp_api_1.whatsappApi.createMessageTemplate(waData.wabaId, waData.accessToken, metaPayload);
        const metaTemplateId = metaRes?.id || metaRes?.template_id;
        await database_1.default.template.update({
            where: { id: template.id },
            data: {
                metaTemplateId: metaTemplateId ? String(metaTemplateId) : template.metaTemplateId,
                status: 'PENDING',
                rejectionReason: null,
            },
        });
        console.log('✅ Template submitted to Meta:', metaTemplateId);
        return {
            message: 'Template submitted to Meta. It will appear as PENDING until approved.',
            metaTemplateId: metaTemplateId ? String(metaTemplateId) : undefined,
        };
    }
    async getLanguages(organizationId, whatsappAccountId) {
        const where = { organizationId };
        const templates = await database_1.default.template.groupBy({
            by: ['language'],
            where,
            _count: { language: true },
            orderBy: { _count: { language: 'desc' } },
        });
        return templates.map((t) => ({
            language: t.language,
            count: t._count.language
        }));
    }
    async updateStatus(metaTemplateId, status, rejectionReason) {
        await database_1.default.template.updateMany({
            where: { metaTemplateId },
            data: {
                status,
                rejectionReason: rejectionReason || null
            },
        });
        console.log(`✅ Template status updated: ${metaTemplateId} -> ${status}`);
    }
    async syncTemplatesForAccount(organizationId, whatsappAccountId) {
        return meta_service_1.metaService.syncTemplates(whatsappAccountId, organizationId);
    }
}
exports.TemplatesService = TemplatesService;
exports.templatesService = new TemplatesService();
exports.default = exports.templatesService;
//# sourceMappingURL=templates.service.js.map