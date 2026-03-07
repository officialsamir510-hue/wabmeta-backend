// ✅ CREATE: src/modules/automation/automation.engine.ts

import prisma from '../../config/database';
import { whatsappService } from '../whatsapp/whatsapp.service';
import { automationService } from './automation.service';
import { crmService } from '../crm/crm.service';
import { AutomationTrigger } from '@prisma/client';

interface AutomationAction {
    id: string;
    type: string;
    config: any;
}

interface TriggerContext {
    organizationId: string;
    contactId?: string;
    phone?: string;
    message?: string;
    conversationId?: string;
    metadata?: any;
}

class AutomationEngine {
    // ==========================================
    // TRIGGER: NEW CONTACT
    // ==========================================
    async triggerNewContact(context: TriggerContext): Promise<void> {
        console.log(`🤖 [AUTOMATION] Triggering NEW_CONTACT for org: ${context.organizationId}`);

        try {
            const automations = await automationService.getActiveByTrigger(
                context.organizationId,
                'NEW_CONTACT'
            );

            for (const automation of automations) {
                console.log(`🤖 Executing automation: ${automation.name}`);
                await this.executeActions(automation.id, automation.actions, context);
            }
        } catch (error) {
            console.error('🤖 NEW_CONTACT automation error:', error);
        }
    }

    // ==========================================
    // TRIGGER: KEYWORD MATCH
    // ==========================================
    async triggerKeyword(context: TriggerContext): Promise<boolean> {
        if (!context.message) return false;

        console.log(`🤖 [AUTOMATION] Checking KEYWORD triggers for: "${context.message}"`);

        try {
            const automations = await automationService.getActiveByTrigger(
                context.organizationId,
                'KEYWORD'
            );

            let triggered = false;

            for (const automation of automations) {
                const keywords: string[] = automation.triggerConfig?.keywords || [];
                const exactMatch = automation.triggerConfig?.exactMatch || false;

                const messageL = context.message.toLowerCase().trim();

                const matched = keywords.some((keyword) => {
                    const keywordL = keyword.toLowerCase().trim();
                    if (exactMatch) {
                        return messageL === keywordL;
                    }
                    return messageL.includes(keywordL);
                });

                if (matched) {
                    console.log(`🤖 Keyword matched! Executing automation: ${automation.name}`);
                    await this.executeActions(automation.id, automation.actions, context);
                    triggered = true;
                }
            }

            return triggered;
        } catch (error) {
            console.error('🤖 KEYWORD automation error:', error);
            return false;
        }
    }

    // ==========================================
    // TRIGGER: WEBHOOK
    // ==========================================
    async triggerWebhook(
        organizationId: string,
        automationId: string,
        webhookData: any
    ): Promise<void> {
        console.log(`🤖 [AUTOMATION] Triggering WEBHOOK for automation: ${automationId}`);

        try {
            const automation = await automationService.getById(organizationId, automationId);

            if (!automation.isActive || automation.trigger !== 'WEBHOOK') {
                console.log('🤖 Automation not active or not webhook type');
                return;
            }

            const context: TriggerContext = {
                organizationId,
                metadata: webhookData,
                phone: webhookData.phone,
                contactId: webhookData.contactId,
            };

            await this.executeActions(automation.id, automation.actions, context);
        } catch (error) {
            console.error('🤖 WEBHOOK automation error:', error);
        }
    }

    // ==========================================
    // TRIGGER: SCHEDULE (Called by cron job)
    // ==========================================
    async triggerScheduled(): Promise<void> {
        console.log(`🤖 [AUTOMATION] Running scheduled automations check`);

        try {
            const now = new Date();
            const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            const currentDay = now.getDay(); // 0 = Sunday

            const automations = await prisma.automation.findMany({
                where: {
                    trigger: 'SCHEDULE',
                    isActive: true,
                },
            });

            for (const automation of automations) {
                const config = automation.triggerConfig as any;
                const scheduleTime = config?.time || '09:00';
                const days = config?.days || 'daily';

                // Check if time matches (with 1 minute tolerance)
                if (scheduleTime !== currentTime) continue;

                // Check if day matches
                const isWeekday = currentDay >= 1 && currentDay <= 5;
                const isWeekend = currentDay === 0 || currentDay === 6;

                if (days === 'weekdays' && !isWeekday) continue;
                if (days === 'weekends' && !isWeekend) continue;

                console.log(`🤖 Running scheduled automation: ${automation.name}`);

                // Get all active contacts for this organization
                const contacts = await prisma.contact.findMany({
                    where: {
                        organizationId: automation.organizationId,
                        status: 'ACTIVE',
                    },
                    take: 1000, // Limit for safety
                });

                for (const contact of contacts) {
                    const context: TriggerContext = {
                        organizationId: automation.organizationId,
                        contactId: contact.id,
                        phone: contact.phone,
                    };

                    await this.executeActions(automation.id, automation.actions as any, context);
                }
            }
        } catch (error) {
            console.error('🤖 SCHEDULE automation error:', error);
        }
    }

    // ==========================================
    // TRIGGER: INACTIVITY (Called by cron job)
    // ==========================================
    async triggerInactivity(): Promise<void> {
        console.log(`🤖 [AUTOMATION] Checking INACTIVITY automations`);

        try {
            const automations = await prisma.automation.findMany({
                where: {
                    trigger: 'INACTIVITY',
                    isActive: true,
                },
            });

            for (const automation of automations) {
                const config = automation.triggerConfig as any;
                const inactiveHours = config?.hours || 24;
                const cutoffTime = new Date(Date.now() - inactiveHours * 60 * 60 * 1000);

                // Find contacts who haven't messaged since cutoff
                const inactiveContacts = await prisma.contact.findMany({
                    where: {
                        organizationId: automation.organizationId,
                        status: 'ACTIVE',
                        lastMessageAt: {
                            lt: cutoffTime,
                            not: null,
                        },
                    },
                    take: 100,
                });

                console.log(`🤖 Found ${inactiveContacts.length} inactive contacts for: ${automation.name}`);

                for (const contact of inactiveContacts) {
                    const context: TriggerContext = {
                        organizationId: automation.organizationId,
                        contactId: contact.id,
                        phone: contact.phone,
                    };

                    await this.executeActions(automation.id, automation.actions as any, context);
                }
            }
        } catch (error) {
            console.error('🤖 INACTIVITY automation error:', error);
        }
    }

    // ==========================================
    // EXECUTE ACTIONS
    // ==========================================
    private async executeActions(
        automationId: string,
        actions: AutomationAction[],
        context: TriggerContext
    ): Promise<void> {
        console.log(`🤖 Executing ${actions.length} actions for automation: ${automationId}`);

        for (const action of actions) {
            try {
                console.log(`🤖 Executing action: ${action.type}`);

                switch (action.type) {
                    case 'send_message':
                        await this.actionSendMessage(context, action.config);
                        break;

                    case 'send_template':
                        await this.actionSendTemplate(context, action.config);
                        break;

                    case 'add_tag':
                        await this.actionAddTag(context, action.config);
                        break;

                    case 'remove_tag':
                        await this.actionRemoveTag(context, action.config);
                        break;

                    case 'create_lead':
                        await this.actionCreateLead(context, action.config);
                        break;

                    case 'webhook':
                        await this.actionCallWebhook(context, action.config);
                        break;

                    case 'delay':
                        await this.actionDelay(action.config);
                        break;

                    default:
                        console.warn(`🤖 Unknown action type: ${action.type}`);
                }
            } catch (error: any) {
                console.error(`🤖 Action ${action.type} failed:`, error.message);
                // Continue with other actions
            }
        }

        // Increment execution count
        await automationService.incrementExecutionCount(automationId);
    }

    // ==========================================
    // ACTION: SEND MESSAGE
    // ==========================================
    private async actionSendMessage(context: TriggerContext, config: any): Promise<void> {
        if (!context.phone || !config.message) {
            console.warn('🤖 Cannot send message: missing phone or message');
            return;
        }

        // Get default WhatsApp account
        const account = await prisma.whatsAppAccount.findFirst({
            where: {
                organizationId: context.organizationId,
                status: 'CONNECTED',
            },
            orderBy: { isDefault: 'desc' },
        });

        if (!account) {
            console.warn('🤖 No WhatsApp account connected');
            return;
        }

        // Replace variables in message
        const message = await this.replaceVariables(config.message, context);

        await whatsappService.sendTextMessage(
            account.id,
            context.phone,
            message,
            context.conversationId,
            context.organizationId
        );

        console.log(`🤖 Sent message to ${context.phone}`);
    }

    // ==========================================
    // ACTION: SEND TEMPLATE
    // ==========================================
    private async actionSendTemplate(context: TriggerContext, config: any): Promise<void> {
        if (!context.phone || !config.templateId) {
            console.warn('🤖 Cannot send template: missing phone or templateId');
            return;
        }

        const template = await prisma.template.findUnique({
            where: { id: config.templateId },
        });

        if (!template || template.status !== 'APPROVED') {
            console.warn('🤖 Template not found or not approved');
            return;
        }

        const account = await prisma.whatsAppAccount.findFirst({
            where: {
                organizationId: context.organizationId,
                status: 'CONNECTED',
            },
            orderBy: { isDefault: 'desc' },
        });

        if (!account) {
            console.warn('🤖 No WhatsApp account connected');
            return;
        }

        await whatsappService.sendTemplateMessage({
            accountId: account.id,
            to: context.phone,
            templateName: template.name,
            templateLanguage: template.language,
            conversationId: context.conversationId,
            organizationId: context.organizationId,
        });

        console.log(`🤖 Sent template ${template.name} to ${context.phone}`);
    }

    // ==========================================
    // ACTION: ADD TAG
    // ==========================================
    private async actionAddTag(context: TriggerContext, config: any): Promise<void> {
        if (!context.contactId || !config.tag) {
            console.warn('🤖 Cannot add tag: missing contactId or tag');
            return;
        }

        await prisma.contact.update({
            where: { id: context.contactId },
            data: {
                tags: {
                    push: config.tag,
                },
            },
        });

        console.log(`🤖 Added tag "${config.tag}" to contact ${context.contactId}`);
    }

    // ==========================================
    // ACTION: REMOVE TAG
    // ==========================================
    private async actionRemoveTag(context: TriggerContext, config: any): Promise<void> {
        if (!context.contactId || !config.tag) {
            console.warn('🤖 Cannot remove tag: missing contactId or tag');
            return;
        }

        const contact = await prisma.contact.findUnique({
            where: { id: context.contactId },
        });

        if (!contact) return;

        const newTags = (contact.tags || []).filter((t) => t !== config.tag);

        await prisma.contact.update({
            where: { id: context.contactId },
            data: { tags: newTags },
        });

        console.log(`🤖 Removed tag "${config.tag}" from contact ${context.contactId}`);
    }

    // ==========================================
    // ACTION: CREATE LEAD
    // ==========================================
    private async actionCreateLead(context: TriggerContext, config: any): Promise<void> {
        if (!context.contactId) {
            console.warn('🤖 Cannot create lead: missing contactId');
            return;
        }

        // Check if lead already exists for this contact
        const existingLead = await prisma.lead.findFirst({
            where: {
                organizationId: context.organizationId,
                contactId: context.contactId,
                status: { notIn: ['WON', 'LOST'] },
            },
        });

        if (existingLead) {
            console.log(`🤖 Lead already exists for contact ${context.contactId}`);
            return;
        }

        await crmService.createLead(context.organizationId, 'automation', {
            title: config.title || 'Automated Lead',
            contactId: context.contactId,
            source: 'automation',
        });

        console.log(`🤖 Created lead for contact ${context.contactId}`);
    }

    // ==========================================
    // ACTION: CALL WEBHOOK
    // ==========================================
    private async actionCallWebhook(context: TriggerContext, config: any): Promise<void> {
        if (!config.url) {
            console.warn('🤖 Cannot call webhook: missing URL');
            return;
        }

        try {
            const contact = context.contactId
                ? await prisma.contact.findUnique({ where: { id: context.contactId } })
                : null;

            const response = await fetch(config.url, {
                method: config.method || 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(config.headers || {}),
                },
                body: JSON.stringify({
                    event: 'automation_trigger',
                    organizationId: context.organizationId,
                    contact: contact
                        ? {
                            id: contact.id,
                            phone: contact.phone,
                            firstName: contact.firstName,
                            lastName: contact.lastName,
                            email: contact.email,
                        }
                        : null,
                    message: context.message,
                    metadata: context.metadata,
                    timestamp: new Date().toISOString(),
                }),
            });

            console.log(`🤖 Webhook called: ${config.url} - Status: ${response.status}`);
        } catch (error: any) {
            console.error(`🤖 Webhook failed: ${error.message}`);
        }
    }

    // ==========================================
    // ACTION: DELAY
    // ==========================================
    private async actionDelay(config: any): Promise<void> {
        const duration = config.duration || 1;
        const unit = config.unit || 'seconds';

        let ms = duration * 1000; // Default: seconds
        if (unit === 'minutes') ms = duration * 60 * 1000;
        if (unit === 'hours') ms = duration * 60 * 60 * 1000;

        console.log(`🤖 Waiting for ${duration} ${unit}...`);
        await new Promise((resolve) => setTimeout(resolve, ms));
    }

    // ==========================================
    // REPLACE VARIABLES IN TEXT
    // ==========================================
    private async replaceVariables(text: string, context: TriggerContext): Promise<string> {
        let result = text;

        // Get contact data if available
        if (context.contactId) {
            const contact = await prisma.contact.findUnique({
                where: { id: context.contactId },
            });

            if (contact) {
                result = result.replace(/\{\{firstName\}\}/gi, contact.firstName || '');
                result = result.replace(/\{\{lastName\}\}/gi, contact.lastName || '');
                result = result.replace(/\{\{phone\}\}/gi, contact.phone || '');
                result = result.replace(/\{\{email\}\}/gi, contact.email || '');
                result = result.replace(
                    /\{\{name\}\}/gi,
                    [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'there'
                );
            }
        }

        // Replace other variables
        result = result.replace(/\{\{date\}\}/gi, new Date().toLocaleDateString());
        result = result.replace(/\{\{time\}\}/gi, new Date().toLocaleTimeString());

        return result;
    }
}

export const automationEngine = new AutomationEngine();
export default automationEngine;