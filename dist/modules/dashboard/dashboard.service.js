"use strict";
// src/modules/dashboard/dashboard.service.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardService = exports.DashboardService = void 0;
const database_1 = __importDefault(require("../../config/database"));
class DashboardService {
    async getDashboardStats(userId, organizationId) {
        try {
            const totalContacts = await database_1.default.contact.count({ where: { organizationId } });
            const totalCampaigns = await database_1.default.campaign.count({ where: { organizationId } });
            const totalTemplates = await database_1.default.template.count({ where: { organizationId } });
            const totalConversations = await database_1.default.conversation.count({ where: { organizationId } });
            const messagesStats = await this.getMessageStats(organizationId);
            return {
                totalContacts,
                totalCampaigns,
                totalTemplates,
                totalConversations,
                ...messagesStats
            };
        }
        catch (error) {
            console.error('getDashboardStats error:', error);
            throw error;
        }
    }
    async getQuickStats(organizationId) {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const contactsToday = await database_1.default.contact.count({
                where: {
                    organizationId,
                    createdAt: { gte: today }
                }
            });
            const messagesToday = await database_1.default.message.count({
                where: {
                    conversation: { organizationId },
                    createdAt: { gte: today }
                }
            });
            const campaignsActive = await database_1.default.campaign.count({
                where: {
                    organizationId,
                    status: 'RUNNING'
                }
            });
            const unreadConversations = await database_1.default.conversation.count({
                where: {
                    organizationId,
                    unreadCount: { gt: 0 }
                }
            });
            return {
                contactsToday,
                messagesToday,
                campaignsActive,
                unreadConversations
            };
        }
        catch (error) {
            console.error('getQuickStats error:', error);
            throw error;
        }
    }
    async getChartData(organizationId, days = 7) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            startDate.setHours(0, 0, 0, 0);
            // Get messages grouped by date
            const messages = await database_1.default.message.groupBy({
                by: ['createdAt'],
                where: {
                    conversation: { organizationId },
                    createdAt: { gte: startDate }
                },
                _count: { id: true }
            });
            // Get contacts grouped by date
            const contacts = await database_1.default.contact.groupBy({
                by: ['createdAt'],
                where: {
                    organizationId,
                    createdAt: { gte: startDate }
                },
                _count: { id: true }
            });
            return {
                messages: this.formatChartData(messages, days),
                contacts: this.formatChartData(contacts, days)
            };
        }
        catch (error) {
            console.error('getChartData error:', error);
            throw error;
        }
    }
    // ✅ NEW: Get widgets data
    async getWidgetsData(organizationId, days = 7) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            startDate.setHours(0, 0, 0, 0);
            const [totalContacts, newContacts, totalMessages, sentMessages, deliveredMessages, readMessages, failedMessages, activeCampaigns, completedCampaigns, totalTemplates, approvedTemplates, unreadConversations, whatsappAccounts] = await Promise.all([
                // Total contacts
                database_1.default.contact.count({ where: { organizationId } }),
                // New contacts in period
                database_1.default.contact.count({
                    where: {
                        organizationId,
                        createdAt: { gte: startDate }
                    }
                }),
                // Total messages
                database_1.default.message.count({
                    where: {
                        conversation: { organizationId }
                    }
                }),
                // Messages sent in period
                database_1.default.message.count({
                    where: {
                        conversation: { organizationId },
                        direction: 'OUTBOUND',
                        createdAt: { gte: startDate }
                    }
                }),
                // Delivered messages
                database_1.default.message.count({
                    where: {
                        conversation: { organizationId },
                        status: 'DELIVERED',
                        createdAt: { gte: startDate }
                    }
                }),
                // Read messages
                database_1.default.message.count({
                    where: {
                        conversation: { organizationId },
                        status: 'READ',
                        createdAt: { gte: startDate }
                    }
                }),
                // Failed messages
                database_1.default.message.count({
                    where: {
                        conversation: { organizationId },
                        status: 'FAILED',
                        createdAt: { gte: startDate }
                    }
                }),
                // Active campaigns
                database_1.default.campaign.count({
                    where: {
                        organizationId,
                        status: { in: ['RUNNING', 'SCHEDULED'] }
                    }
                }),
                // Completed campaigns
                database_1.default.campaign.count({
                    where: {
                        organizationId,
                        status: 'COMPLETED'
                    }
                }),
                // Total templates
                database_1.default.template.count({ where: { organizationId } }),
                // Approved templates
                database_1.default.template.count({
                    where: {
                        organizationId,
                        status: 'APPROVED'
                    }
                }),
                // Unread conversations
                database_1.default.conversation.count({
                    where: {
                        organizationId,
                        unreadCount: { gt: 0 }
                    }
                }),
                // WhatsApp accounts
                database_1.default.whatsAppAccount.count({
                    where: {
                        organizationId,
                        status: 'CONNECTED'
                    }
                })
            ]);
            // Calculate rates
            const deliveryRate = sentMessages > 0
                ? Math.round((deliveredMessages / sentMessages) * 100)
                : 0;
            const readRate = deliveredMessages > 0
                ? Math.round((readMessages / deliveredMessages) * 100)
                : 0;
            const failureRate = sentMessages > 0
                ? Math.round((failedMessages / sentMessages) * 100)
                : 0;
            return {
                contacts: {
                    total: totalContacts,
                    new: newContacts,
                    growthRate: totalContacts > 0 ? Math.round((newContacts / totalContacts) * 100) : 0
                },
                messages: {
                    total: totalMessages,
                    sent: sentMessages,
                    delivered: deliveredMessages,
                    read: readMessages,
                    failed: failedMessages,
                    deliveryRate,
                    readRate,
                    failureRate
                },
                campaigns: {
                    active: activeCampaigns,
                    completed: completedCampaigns,
                    total: activeCampaigns + completedCampaigns
                },
                templates: {
                    total: totalTemplates,
                    approved: approvedTemplates,
                    pending: totalTemplates - approvedTemplates
                },
                conversations: {
                    unread: unreadConversations
                },
                whatsapp: {
                    connectedAccounts: whatsappAccounts
                },
                period: {
                    days,
                    startDate: startDate.toISOString(),
                    endDate: new Date().toISOString()
                }
            };
        }
        catch (error) {
            console.error('getWidgetsData error:', error);
            throw error;
        }
    }
    // ✅ NEW: Get recent activity
    async getRecentActivity(organizationId, limit = 10) {
        try {
            const [recentMessages, recentCampaigns, recentContacts] = await Promise.all([
                // Recent messages
                database_1.default.message.findMany({
                    where: {
                        conversation: { organizationId }
                    },
                    orderBy: { createdAt: 'desc' },
                    take: limit,
                    include: {
                        conversation: {
                            include: {
                                contact: {
                                    select: {
                                        id: true,
                                        firstName: true,
                                        lastName: true,
                                        phone: true
                                    }
                                }
                            }
                        }
                    }
                }),
                // Recent campaigns
                database_1.default.campaign.findMany({
                    where: { organizationId },
                    orderBy: { updatedAt: 'desc' },
                    take: 5,
                    select: {
                        id: true,
                        name: true,
                        status: true,
                        sentCount: true,
                        totalContacts: true,
                        updatedAt: true
                    }
                }),
                // Recent contacts
                database_1.default.contact.findMany({
                    where: { organizationId },
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        phone: true,
                        createdAt: true
                    }
                })
            ]);
            // Format activity items
            const activities = [
                ...recentMessages.map(msg => ({
                    type: 'message',
                    id: msg.id,
                    title: msg.direction === 'INBOUND' ? 'Message received' : 'Message sent',
                    description: msg.content?.substring(0, 50) || 'Media message',
                    contact: msg.conversation?.contact
                        ? `${msg.conversation.contact.firstName || ''} ${msg.conversation.contact.lastName || ''}`.trim() || msg.conversation.contact.phone
                        : 'Unknown',
                    timestamp: msg.createdAt,
                    status: msg.status
                })),
                ...recentCampaigns.map(camp => ({
                    type: 'campaign',
                    id: camp.id,
                    title: `Campaign: ${camp.name}`,
                    description: `${camp.sentCount}/${camp.totalContacts} sent`,
                    timestamp: camp.updatedAt,
                    status: camp.status
                })),
                ...recentContacts.map(contact => ({
                    type: 'contact',
                    id: contact.id,
                    title: 'New contact added',
                    description: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.phone,
                    timestamp: contact.createdAt
                }))
            ];
            // Sort by timestamp
            activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            return activities.slice(0, limit);
        }
        catch (error) {
            console.error('getRecentActivity error:', error);
            throw error;
        }
    }
    async getMessageStats(organizationId) {
        try {
            const [sent, delivered, read, failed] = await Promise.all([
                database_1.default.message.count({
                    where: {
                        conversation: { organizationId },
                        direction: 'OUTBOUND'
                    }
                }),
                database_1.default.message.count({
                    where: {
                        conversation: { organizationId },
                        status: 'DELIVERED'
                    }
                }),
                database_1.default.message.count({
                    where: {
                        conversation: { organizationId },
                        status: 'READ'
                    }
                }),
                database_1.default.message.count({
                    where: {
                        conversation: { organizationId },
                        status: 'FAILED'
                    }
                })
            ]);
            return {
                messagesSent: sent,
                messagesDelivered: delivered,
                messagesRead: read,
                messagesFailed: failed,
                deliveryRate: sent > 0 ? Math.round((delivered / sent) * 100) : 0,
                readRate: delivered > 0 ? Math.round((read / delivered) * 100) : 0
            };
        }
        catch (error) {
            console.error('getMessageStats error:', error);
            return {
                messagesSent: 0,
                messagesDelivered: 0,
                messagesRead: 0,
                messagesFailed: 0,
                deliveryRate: 0,
                readRate: 0
            };
        }
    }
    formatChartData(data, days) {
        const result = [];
        const today = new Date();
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const count = data.filter(d => {
                const dDate = new Date(d.createdAt).toISOString().split('T')[0];
                return dDate === dateStr;
            }).reduce((sum, d) => sum + (d._count?.id || 0), 0);
            result.push({
                date: dateStr,
                count
            });
        }
        return result;
    }
}
exports.DashboardService = DashboardService;
exports.dashboardService = new DashboardService();
//# sourceMappingURL=dashboard.service.js.map