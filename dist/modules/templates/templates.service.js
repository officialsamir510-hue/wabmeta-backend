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
});
// Extract variables from body text ({{1}}, {{2}}, etc.)
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
        'en': 'en_US',
        'hi': 'hi_IN',
        'es': 'es_ES',
        'pt': 'pt_BR',
        'ar': 'ar_SA',
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
    // HEADER (TEXT supported)
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
            // Media header requires header_handle
            throw new errorHandler_1.AppError(`HeaderType ${headerType} requires media upload. Use TEXT header for now.`, 400);
        }
    }
    // BODY
    const bodyVars = extractVariables(t.bodyText);
    const bodyComp = { type: 'BODY', text: t.bodyText };
    if (bodyVars.length > 0) {
        bodyComp.example = {
            body_text: [bodyVars.map((i) => `Example${i}`)]
        };
    }
    components.push(bodyComp);
    // FOOTER
    if (t.footerText) {
        components.push({ type: 'FOOTER', text: t.footerText });
    }
    // BUTTONS
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
 * ✅ Multi-tenant credentials resolver (UPDATED)
 * Priority:
 * 1) MetaConnection (new connect flow)
 * 2) WhatsAppAccount (old/manual connect flow)
 */
const getConnectedWabaCredentials = async (organizationId, whatsappAccountId) => {
    try {
        console.log('🔍 Getting WABA credentials for org:', organizationId);
        // 1) Try MetaConnection first (new system)
        const metaConn = await database_1.default.metaConnection.findUnique({
            where: { organizationId },
            include: {
                PhoneNumber: {
                    where: { isActive: true },
                    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
                    take: 1,
                },
            },
        });
        if (metaConn && metaConn.status === 'CONNECTED' && metaConn.accessToken && metaConn.wabaId) {
            console.log('✅ Using MetaConnection credentials');
            // Token is already stored as plain text in your current implementation
            // If you're using encryption, uncomment the next line:
            // const accessToken = EncryptionUtil.decrypt(metaConn.accessToken);
            const accessToken = metaConn.accessToken;
            return {
                source: 'META_CONNECTION',
                wabaId: metaConn.wabaId,
                accessToken,
                phoneNumberId: metaConn.PhoneNumber?.[0]?.phoneNumberId || null, // ✅ Fixed: phoneNumbers -> PhoneNumber
            };
        }
        console.log('⚠️ MetaConnection not found or not connected, trying WhatsAppAccount...');
        // 2) Fallback to WhatsAppAccount (old system)
        const where = {
            organizationId,
            status: 'CONNECTED',
        };
        if (whatsappAccountId) {
            where.id = whatsappAccountId;
        }
        else {
            where.isDefault = true;
        }
        const wa = await database_1.default.whatsAppAccount.findFirst({
            where,
            orderBy: { isDefault: 'desc' },
        });
        if (!wa) {
            throw new errorHandler_1.AppError('No connected WhatsApp account found. Please connect WhatsApp first.', 400);
        }
        if (!wa.wabaId) {
            throw new errorHandler_1.AppError('WABA ID missing on WhatsApp account.', 400);
        }
        if (!wa.accessToken) {
            throw new errorHandler_1.AppError('Access token missing on WhatsApp account.', 400);
        }
        console.log('✅ Using WhatsAppAccount credentials');
        return {
            source: 'WHATSAPP_ACCOUNT',
            wabaId: wa.wabaId,
            accessToken: wa.accessToken,
            phoneNumberId: wa.phoneNumberId || null,
        };
    }
    catch (error) {
        console.error('❌ Get WABA credentials error:', error);
        if (error instanceof errorHandler_1.AppError) {
            throw error;
        }
        throw new errorHandler_1.AppError('Failed to get WhatsApp credentials: ' + error.message, 500);
    }
};
// ============================================
// SERVICE
// ============================================
class TemplatesService {
    // ==========================================
    // VALIDATE TEMPLATE
    // ==========================================
    validateTemplate(input) {
        const errors = [];
        // Name validation
        if (!/^[a-z0-9_]+$/.test(input.name)) {
            errors.push('Template name must be lowercase with underscores only (a-z, 0-9, _)');
        }
        if (input.name.length < 1 || input.name.length > 512) {
            errors.push('Template name must be between 1 and 512 characters');
        }
        // Body text validation
        if (!input.bodyText || input.bodyText.trim().length === 0) {
            errors.push('Body text is required');
        }
        if (input.bodyText && input.bodyText.length > 1024) {
            errors.push('Body text exceeds 1024 characters');
        }
        // Header validation
        const headerType = normalizeHeaderType(input.headerType);
        if (headerType === 'TEXT' && input.headerContent) {
            if (input.headerContent.length > 60) {
                errors.push('Header text exceeds 60 characters');
            }
        }
        // Footer validation
        if (input.footerText && input.footerText.length > 60) {
            errors.push('Footer text exceeds 60 characters');
        }
        // Buttons validation
        if (input.buttons && input.buttons.length > 3) {
            errors.push('Maximum 3 buttons allowed');
        }
        // Variables validation
        const varsInBody = extractVariables(input.bodyText);
        for (let i = 0; i < varsInBody.length; i++) {
            if (varsInBody[i] !== i + 1) {
                errors.push(`Variables must be sequential starting from {{1}}. Found gap at {{${i + 1}}}`);
                break;
            }
        }
        return { valid: errors.length === 0, errors };
    }
    // ==========================================
    // CREATE TEMPLATE
    // ==========================================
    async create(organizationId, input) {
        const { name, language, category, headerType, headerContent, bodyText, footerText, buttons, variables } = input;
        // Validate template
        const validation = this.validateTemplate(input);
        if (!validation.valid) {
            throw new errorHandler_1.AppError(`Validation failed: ${validation.errors.join(', ')}`, 400);
        }
        // Check for duplicates
        const existing = await database_1.default.template.findUnique({
            where: {
                organizationId_name_language: { organizationId, name, language },
            },
        });
        if (existing) {
            throw new errorHandler_1.AppError('Template with this name and language already exists', 409);
        }
        // Auto-extract variables if not provided
        const extractedVars = extractVariables(bodyText);
        const finalVariables = variables && variables.length > 0
            ? variables
            : extractedVars.map((index) => ({ index, type: 'text' }));
        // Create local template first
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
        console.log(`✅ Template created locally: ${template.id}`);
        // Submit to Meta
        try {
            const wa = await getConnectedWabaCredentials(organizationId);
            const metaPayload = buildMetaTemplatePayload({
                name,
                language,
                category,
                headerType: headerType || null,
                headerContent: headerContent || null,
                bodyText,
                footerText: footerText || null,
                buttons: (buttons || []),
            });
            console.log('📤 Submitting template to Meta:', { name, wabaId: wa.wabaId });
            const metaRes = await whatsapp_api_1.whatsappApi.createMessageTemplate(wa.wabaId, wa.accessToken, metaPayload);
            const metaTemplateId = metaRes?.id || metaRes?.template_id;
            if (!metaTemplateId) {
                throw new errorHandler_1.AppError('Meta did not return template ID', 502);
            }
            await database_1.default.template.update({
                where: { id: template.id },
                data: {
                    metaTemplateId: String(metaTemplateId),
                    status: 'PENDING',
                    rejectionReason: null,
                },
            });
            console.log('✅ Meta template created:', { metaTemplateId, name, source: wa.source });
        }
        catch (e) {
            const msg = String(e?.response?.data?.error?.message || e?.message || 'Meta submission failed');
            console.error('❌ Meta template create failed:', e?.response?.data || e);
            // Mark as rejected locally
            await database_1.default.template.update({
                where: { id: template.id },
                data: {
                    status: 'REJECTED',
                    rejectionReason: msg,
                },
            });
        }
        const latest = await database_1.default.template.findUnique({ where: { id: template.id } });
        return formatTemplate(latest);
    }
    // ==========================================
    // DUPLICATE TEMPLATE
    // ==========================================
    async duplicate(organizationId, templateId, newName) {
        const original = await database_1.default.template.findFirst({
            where: { id: templateId, organizationId }
        });
        if (!original) {
            throw new errorHandler_1.AppError('Template not found', 404);
        }
        const dup = await database_1.default.template.findUnique({
            where: {
                organizationId_name_language: {
                    organizationId,
                    name: newName,
                    language: original.language,
                },
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
    // ==========================================
    // GET APPROVED TEMPLATES
    // ==========================================
    async getApprovedTemplates(organizationId) {
        const templates = await database_1.default.template.findMany({
            where: { organizationId, status: 'APPROVED' },
            orderBy: { name: 'asc' },
        });
        return templates.map(formatTemplate);
    }
    // ==========================================
    // GET LANGUAGES
    // ==========================================
    async getLanguages(organizationId) {
        const templates = await database_1.default.template.groupBy({
            by: ['language'],
            where: { organizationId },
            _count: { language: true },
            orderBy: { _count: { language: 'desc' } },
        });
        return templates.map((t) => ({
            language: t.language,
            count: t._count.language
        }));
    }
    // ==========================================
    // GET TEMPLATES LIST
    // ==========================================
    async getList(organizationId, query) {
        const { page = 1, limit = 20, search, status, category, language, sortBy = 'createdAt', sortOrder = 'desc', } = query;
        const skip = (page - 1) * limit;
        const where = { organizationId };
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { bodyText: { contains: search, mode: 'insensitive' } },
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
                orderBy: { [sortBy]: sortOrder }
            }),
            database_1.default.template.count({ where }),
        ]);
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
    // ==========================================
    // GET TEMPLATE BY ID
    // ==========================================
    async getById(organizationId, templateId) {
        const template = await database_1.default.template.findFirst({
            where: { id: templateId, organizationId }
        });
        if (!template) {
            throw new errorHandler_1.AppError('Template not found', 404);
        }
        return formatTemplate(template);
    }
    // ==========================================
    // UPDATE TEMPLATE
    // ==========================================
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
        // Reset to pending if content changed
        if (input.bodyText || input.headerContent) {
            updateData.status = 'PENDING';
        }
        const updated = await database_1.default.template.update({
            where: { id: templateId },
            data: updateData
        });
        console.log(`✅ Template updated: ${templateId}`);
        return formatTemplate(updated);
    }
    // ==========================================
    // DELETE TEMPLATE
    // ==========================================
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
    // ==========================================
    // GET TEMPLATE STATS
    // ==========================================
    async getStats(organizationId) {
        try {
            const [total, pending, approved, rejected, marketing, utility, authentication] = await Promise.all([
                database_1.default.template.count({ where: { organizationId } }),
                database_1.default.template.count({ where: { organizationId, status: 'PENDING' } }),
                database_1.default.template.count({ where: { organizationId, status: 'APPROVED' } }),
                database_1.default.template.count({ where: { organizationId, status: 'REJECTED' } }),
                database_1.default.template.count({ where: { organizationId, category: 'MARKETING' } }),
                database_1.default.template.count({ where: { organizationId, category: 'UTILITY' } }),
                database_1.default.template.count({ where: { organizationId, category: 'AUTHENTICATION' } }),
            ]);
            return {
                total,
                pending,
                approved,
                rejected,
                byCategory: {
                    marketing,
                    utility,
                    authentication,
                },
            };
        }
        catch (error) {
            console.error('❌ Get template stats error:', error);
            // Return empty stats on error
            if (error.code === 'P2024') {
                return {
                    total: 0,
                    pending: 0,
                    approved: 0,
                    rejected: 0,
                    byCategory: { marketing: 0, utility: 0, authentication: 0 },
                };
            }
            throw new errorHandler_1.AppError('Failed to fetch template statistics', 500);
        }
    }
    // ==========================================
    // PREVIEW TEMPLATE
    // ==========================================
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
    // ==========================================
    // SUBMIT TO META
    // ==========================================
    async submitToMeta(organizationId, templateId, whatsappAccountId) {
        const template = await database_1.default.template.findFirst({
            where: { id: templateId, organizationId }
        });
        if (!template) {
            throw new errorHandler_1.AppError('Template not found', 404);
        }
        const wa = await getConnectedWabaCredentials(organizationId, whatsappAccountId);
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
        const metaRes = await whatsapp_api_1.whatsappApi.createMessageTemplate(wa.wabaId, wa.accessToken, metaPayload);
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
    // ==========================================
    // SYNC FROM META
    // ==========================================
    async syncFromMeta(organizationId, whatsappAccountId) {
        console.log('🔄 Syncing templates from Meta...');
        const wa = await getConnectedWabaCredentials(organizationId, whatsappAccountId);
        const metaTemplates = await whatsapp_api_1.whatsappApi.listMessageTemplates(wa.wabaId, wa.accessToken);
        console.log(`📥 Found ${metaTemplates.length} templates in Meta`);
        let synced = 0;
        for (const mt of metaTemplates) {
            const metaId = String(mt.id);
            const metaName = String(mt.name);
            const metaLang = String(mt.language);
            const metaStatusRaw = String(mt.status || 'PENDING').toUpperCase();
            const mappedStatus = metaStatusRaw === 'APPROVED' ? 'APPROVED' :
                metaStatusRaw === 'REJECTED' ? 'REJECTED' : 'PENDING';
            const local = await database_1.default.template.findFirst({
                where: {
                    organizationId,
                    OR: [
                        { metaTemplateId: metaId },
                        { name: metaName, language: metaLang }
                    ],
                },
            });
            const rejectionReason = mt.rejected_reason || mt.rejection_reason || null;
            if (local) {
                // Update existing
                await database_1.default.template.update({
                    where: { id: local.id },
                    data: {
                        metaTemplateId: metaId,
                        status: mappedStatus,
                        rejectionReason
                    },
                });
            }
            else {
                // Create new
                await database_1.default.template.create({
                    data: {
                        organizationId,
                        name: metaName,
                        language: metaLang,
                        category: (String(mt.category || 'UTILITY').toUpperCase()),
                        bodyText: mt.components?.find((c) => c.type === 'BODY')?.text || 'Imported from Meta',
                        status: mappedStatus,
                        metaTemplateId: metaId,
                        buttons: toJsonValue([]),
                        variables: toJsonValue([]),
                        rejectionReason,
                    },
                });
            }
            synced++;
        }
        console.log(`✅ Synced ${synced} templates from Meta`);
        return { message: 'Templates synced from Meta', synced };
    }
    // ==========================================
    // UPDATE STATUS (Internal - webhook handler)
    // ==========================================
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
}
exports.TemplatesService = TemplatesService;
exports.templatesService = new TemplatesService();
//# sourceMappingURL=templates.service.js.map