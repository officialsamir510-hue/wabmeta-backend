// src/modules/dashboard/dashboard.service.ts (NEW FILE)

import { prisma } from '../../config/database';

export class DashboardService {
  
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
        organizationId,
        direction: 'outbound',
        createdAt: { gte: last30Days }
      }
    });

    // Total Messages Received (last 30 days)
    const messagesReceived = await prisma.message.count({
      where: {
        organizationId,
        direction: 'inbound',
        createdAt: { gte: last30Days }
      }
    });

    // Active Campaigns
    const activeCampaigns = await prisma.campaign.count({
      where: {
        organizationId,
        status: 'active'
      }
    });

    // Delivery Performance (last 7 days)
    const deliveryStats = await prisma.message.groupBy({
      by: ['status'],
      where: {
        organizationId,
        direction: 'outbound',
        createdAt: { gte: last7Days }
      },
      _count: { status: true }
    });

    // Calculate delivery rate
    const totalOutbound = deliveryStats.reduce((sum, stat) => sum + stat._count.status, 0);
    const delivered = deliveryStats.find(s => s.status === 'delivered')?._count.status || 0;
    const read = deliveryStats.find(s => s.status === 'read')?._count.status || 0;
    const failed = deliveryStats.find(s => s.status === 'failed')?._count.status || 0;

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
        pending: deliveryStats.find(s => s.status === 'pending')?._count.status || 0
      },
      messagesOverview,
      recentActivity
    };
  }

  // Get messages breakdown by day
  private async getMessagesOverview(organizationId: string, startDate: Date) {
    const messages = await prisma.message.findMany({
      where: {
        organizationId,
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
      if (msg.direction === 'outbound') {
        dailyStats[dateKey].sent++;
      } else {
        dailyStats[dateKey].received++;
      }
    });

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
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        contact: {
          select: { name: true, phone: true }
        }
      }
    });

    recentMessages.forEach(msg => {
      activities.push({
        id: msg.id,
        type: 'message',
        action: msg.direction === 'outbound' ? 'message_sent' : 'message_received',
        description: msg.direction === 'outbound' 
          ? `Message sent to ${msg.contact?.name || msg.contact?.phone}`
          : `Message received from ${msg.contact?.name || msg.contact?.phone}`,
        timestamp: msg.createdAt,
        metadata: {
          contactName: msg.contact?.name,
          contactPhone: msg.contact?.phone,
          messageType: msg.messageType
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
        action: `campaign_${campaign.status}`,
        description: `Campaign "${campaign.name}" ${campaign.status}`,
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
      activities.push({
        id: contact.id,
        type: 'contact',
        action: 'contact_added',
        description: `New contact added: ${contact.name || contact.phone}`,
        timestamp: contact.createdAt,
        metadata: {
          contactName: contact.name,
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
    const unreadMessages = await prisma.message.count({
      where: {
        organizationId,
        direction: 'inbound',
        status: { not: 'read' }
      }
    });

    const pendingCampaigns = await prisma.campaign.count({
      where: {
        organizationId,
        status: 'scheduled'
      }
    });

    return {
      unreadMessages,
      pendingCampaigns
    };
  }
}

export const dashboardService = new DashboardService();