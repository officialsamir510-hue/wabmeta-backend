// src/modules/dashboard/dashboard.service.ts

import prisma from '../../config/database';
import { Prisma } from '@prisma/client';

export class DashboardService {
  getDashboardWidgets(organizationId: string, days: number) {
    throw new Error('Method not implemented.');
  }
  
  // Get real dashboard stats for user
  async getDashboardStats(userId: string, organizationId: string) {
    const today = new Date();
    const last7Days = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Total Contacts
    const totalContacts = await prisma.contact.count({
      where: { organizationId }
    });

    // Total Messages Sent (last 30 days)
    const messagesSent = await prisma.message.count({
      where: {
        conversation: {
          organizationId
        },
        direction: 'OUTBOUND',
        createdAt: { gte: last30Days }
      }
    });

    // Total Messages Received (last 30 days)
    const messagesReceived = await prisma.message.count({
      where: {
        conversation: {
          organizationId
        },
        direction: 'INBOUND',
        createdAt: { gte: last30Days }
      }
    });

    // Active Campaigns
    const activeCampaigns = await prisma.campaign.count({
      where: {
        organizationId,
        status: 'RUNNING'
      }
    });

    // Delivery Performance (last 7 days)
    const deliveryStats = await prisma.message.groupBy({
      by: ['status'],
      where: {
        conversation: {
          organizationId
        },
        direction: 'OUTBOUND',
        createdAt: { gte: last7Days }
      },
      _count: { status: true }
    });

    // Calculate delivery rate
    const totalOutbound = deliveryStats.reduce((sum, stat) => sum + stat._count.status, 0);
    const delivered = deliveryStats.find(s => s.status === 'DELIVERED')?._count.status || 0;
    const read = deliveryStats.find(s => s.status === 'READ')?._count.status || 0;
    const failed = deliveryStats.find(s => s.status === 'FAILED')?._count.status || 0;

    const deliveryRate = totalOutbound > 0 ? ((delivered + read) / totalOutbound) * 100 : 0;
    const readRate = totalOutbound > 0 ? (read / totalOutbound) * 100 : 0;

    // Messages Overview (last 7 days - daily breakdown)
    const messagesOverview = await this.getMessagesOverview(organizationId, last7Days);

    // Recent Activity
    const recentActivity = await this.getRecentActivity(organizationId, 10);

    // Active Conversations (last 24 hours)
    const last24Hours = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const activeConversations = await prisma.conversation.count({
      where: {
        organizationId,
        lastMessageAt: { gte: last24Hours }
      }
    });

    // Templates count
    const templatesCount = await prisma.template.count({
      where: { organizationId }
    });

    // Chatbots count
    const chatbotsCount = await prisma.chatbot.count({
      where: { organizationId }
    });

    return {
      stats: {
        totalContacts,
        messagesSent,
        messagesReceived,
        activeCampaigns,
        activeConversations,
        templatesCount,
        chatbotsCount
      },
      deliveryPerformance: {
        deliveryRate: Math.round(deliveryRate * 100) / 100,
        readRate: Math.round(readRate * 100) / 100,
        failedCount: failed,
        totalSent: totalOutbound,
        delivered,
        read,
        pending: deliveryStats.find(s => s.status === 'PENDING')?._count.status || 0
      },
      messagesOverview,
      recentActivity
    };
  }

  // Get messages breakdown by day
  private async getMessagesOverview(organizationId: string, startDate: Date) {
    const messages = await prisma.message.findMany({
      where: {
        conversation: {
          organizationId
        },
        createdAt: { gte: startDate }
      },
      select: {
        direction: true,
        createdAt: true
      }
    });

    // Group by date
    const dailyStats: Record<string, { sent: number; received: number; date: string }> = {};
    
    messages.forEach(msg => {
      const dateKey = msg.createdAt.toISOString().split('T')[0];
      if (!dailyStats[dateKey]) {
        dailyStats[dateKey] = { sent: 0, received: 0, date: dateKey };
      }
      if (msg.direction === 'OUTBOUND') {
        dailyStats[dateKey].sent++;
      } else {
        dailyStats[dateKey].received++;
      }
    });

    // Fill missing dates
    const currentDate = new Date(startDate);
    const today = new Date();
    
    while (currentDate <= today) {
      const dateKey = currentDate.toISOString().split('T')[0];
      if (!dailyStats[dateKey]) {
        dailyStats[dateKey] = { sent: 0, received: 0, date: dateKey };
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Convert to array and sort by date
    return Object.values(dailyStats).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }

  // Get recent activity
  private async getRecentActivity(organizationId: string, limit: number) {
    const activities: any[] = [];

    // Recent messages
    const recentMessages = await prisma.message.findMany({
      where: { 
        conversation: {
          organizationId
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        conversation: {
          include: {
            contact: {
              select: { 
                firstName: true, 
                lastName: true, 
                phone: true 
              }
            }
          }
        }
      }
    });

    recentMessages.forEach(msg => {
      const contact = msg.conversation?.contact;
      const contactName = contact ? 
        [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.phone : 
        'Unknown';

      activities.push({
        id: msg.id,
        type: 'message',
        action: msg.direction === 'OUTBOUND' ? 'message_sent' : 'message_received',
        description: msg.direction === 'OUTBOUND' 
          ? `Message sent to ${contactName}`
          : `Message received from ${contactName}`,
        timestamp: msg.createdAt,
        metadata: {
          contactName: contactName,
          contactPhone: contact?.phone,
          messageType: msg.type
        }
      });
    });

    // Recent campaigns
    const recentCampaigns = await prisma.campaign.findMany({
      where: { organizationId },
      orderBy: { updatedAt: 'desc' },
      take: 3
    });

    recentCampaigns.forEach(campaign => {
      activities.push({
        id: campaign.id,
        type: 'campaign',
        action: `campaign_${campaign.status.toLowerCase()}`,
        description: `Campaign "${campaign.name}" ${campaign.status.toLowerCase()}`,
        timestamp: campaign.updatedAt,
        metadata: {
          campaignName: campaign.name,
          status: campaign.status
        }
      });
    });

    // Recent contacts added
    const recentContacts = await prisma.contact.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 3
    });

    recentContacts.forEach(contact => {
      const contactName = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.phone;
      
      activities.push({
        id: contact.id,
        type: 'contact',
        action: 'contact_added',
        description: `New contact added: ${contactName}`,
        timestamp: contact.createdAt,
        metadata: {
          contactName: contactName,
          contactPhone: contact.phone
        }
      });
    });

    // Sort by timestamp and return
    return activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  // Get quick stats for header
  async getQuickStats(organizationId: string) {
    // Unread conversations (not individual messages)
    const unreadConversations = await prisma.conversation.count({
      where: {
        organizationId,
        isRead: false,
        isArchived: false
      }
    });

    const pendingCampaigns = await prisma.campaign.count({
      where: {
        organizationId,
        status: 'SCHEDULED'
      }
    });

    // Get today's message count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayMessages = await prisma.message.count({
      where: {
        conversation: {
          organizationId
        },
        createdAt: { gte: today }
      }
    });

    return {
      unreadConversations,
      pendingCampaigns,
      todayMessages
    };
  }

  // Get chart data for dashboard
  async getChartData(organizationId: string, days: number = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Get messages for chart
    const messages = await prisma.message.findMany({
      where: {
        conversation: {
          organizationId
        },
        createdAt: { gte: startDate }
      },
      select: {
        direction: true,
        status: true,
        createdAt: true
      }
    });

    // Process data for chart
    const chartData: any[] = [];
    const currentDate = new Date(startDate);
    const today = new Date();

    while (currentDate <= today) {
      const dateString = currentDate.toISOString().split('T')[0];
      const dayMessages = messages.filter(m => 
        m.createdAt.toISOString().split('T')[0] === dateString
      );

      chartData.push({
        date: dateString,
        label: currentDate.toLocaleDateString('en', { weekday: 'short', day: 'numeric' }),
        sent: dayMessages.filter(m => m.direction === 'OUTBOUND').length,
        received: dayMessages.filter(m => m.direction === 'INBOUND').length,
        delivered: dayMessages.filter(m => 
          m.direction === 'OUTBOUND' && 
          (m.status === 'DELIVERED' || m.status === 'READ')
        ).length
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return chartData;
  }

  // Get campaign performance
  async getCampaignPerformance(organizationId: string) {
    const campaigns = await prisma.campaign.findMany({
      where: {
        organizationId,
        status: {
          in: ['COMPLETED', 'RUNNING', 'PAUSED']
        }
      },
      select: {
        id: true,
        name: true,
        status: true,
        totalContacts: true,
        sentCount: true,
        deliveredCount: true,
        readCount: true,
        failedCount: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    return campaigns.map(campaign => {
      const successRate = campaign.totalContacts > 0
        ? ((campaign.deliveredCount + campaign.readCount) / campaign.totalContacts) * 100
        : 0;

      const readRate = campaign.deliveredCount > 0
        ? (campaign.readCount / campaign.deliveredCount) * 100
        : 0;

      return {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        totalContacts: campaign.totalContacts,
        sent: campaign.sentCount,
        delivered: campaign.deliveredCount,
        read: campaign.readCount,
        failed: campaign.failedCount,
        successRate: Math.round(successRate * 100) / 100,
        readRate: Math.round(readRate * 100) / 100
      };
    });
  }
}

export const dashboardService = new DashboardService();