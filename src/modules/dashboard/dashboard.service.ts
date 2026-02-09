import prisma from '../../config/database';
import { MessageDirection, MessageStatus } from '@prisma/client';

type MessagesOverviewPoint = {
  date: string;
  label: string;
  sent: number;
  received: number;
  total: number;
};

type DeliveryPoint = {
  date: string;
  label: string;
  total: number;
  delivered: number;
  read: number;
  failed: number;
  deliveryRate: number;
  readRate: number;
};

type RecentActivityItem = {
  id: string;
  type: 'message' | 'campaign' | 'contact';
  action: string;
  description: string;
  timestamp: string;
  metadata?: any;
};

export class DashboardService {
  private makeDateKey(d: Date) {
    return d.toISOString().slice(0, 10);
  }

  private startOfDay(d: Date) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  private getRangeStart(days: number) {
    const today = this.startOfDay(new Date());
    const start = new Date(today);
    start.setDate(start.getDate() - (days - 1));
    return start;
  }

  private initDays(days: number) {
    const start = this.getRangeStart(days);
    const arr: { date: string; label: string }[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      arr.push({
        date: this.makeDateKey(d),
        label: d.toLocaleDateString('en-US', { weekday: 'short' }),
      });
    }
    return arr;
  }

  async getMessagesOverview(organizationId: string, days: number): Promise<MessagesOverviewPoint[]> {
    const start = this.getRangeStart(days);

    const messages = await prisma.message.findMany({
      where: {
        conversation: { organizationId },
        createdAt: { gte: start },
      },
      select: { direction: true, createdAt: true },
    });

    const base = this.initDays(days);
    const map = new Map<string, MessagesOverviewPoint>(
      base.map((d) => [d.date, { date: d.date, label: d.label, sent: 0, received: 0, total: 0 }])
    );

    for (const m of messages) {
      const key = this.makeDateKey(m.createdAt);
      const row = map.get(key);
      if (!row) continue;

      if (m.direction === MessageDirection.OUTBOUND) row.sent += 1;
      else row.received += 1;

      row.total += 1;
    }

    return base.map((d) => map.get(d.date)!);
  }

  async getDeliveryPerformance(organizationId: string, days: number) {
    const start = this.getRangeStart(days);

    const outbound = await prisma.message.findMany({
      where: {
        conversation: { organizationId },
        direction: MessageDirection.OUTBOUND,
        createdAt: { gte: start },
      },
      select: { status: true, createdAt: true },
    });

    const base = this.initDays(days);
    const map = new Map(
      base.map((d) => [
        d.date,
        {
          date: d.date,
          label: d.label,
          total: 0,
          delivered: 0,
          read: 0,
          failed: 0,
          deliveryRate: 0,
          readRate: 0,
        },
      ])
    );

    let totalSent = 0;
    let delivered = 0;
    let read = 0;
    let failed = 0;
    let pending = 0;

    for (const m of outbound) {
      const key = this.makeDateKey(m.createdAt);
      const row = map.get(key);
      if (!row) continue;

      totalSent += 1;
      row.total += 1;

      if (m.status === MessageStatus.DELIVERED) {
        delivered += 1;
        row.delivered += 1;
      } else if (m.status === MessageStatus.READ) {
        read += 1;
        row.read += 1;
      } else if (m.status === MessageStatus.FAILED) {
        failed += 1;
        row.failed += 1;
      } else if (m.status === MessageStatus.PENDING || m.status === MessageStatus.SENT) {
        pending += 1;
      }
    }

    for (const d of base) {
      const row = map.get(d.date)!;
      const deliveredLike = row.delivered + row.read;
      row.deliveryRate = row.total ? Math.round((deliveredLike / row.total) * 10000) / 100 : 0;
      row.readRate = row.total ? Math.round((row.read / row.total) * 10000) / 100 : 0;
    }

    const summaryDeliveryRate = totalSent ? Math.round(((delivered + read) / totalSent) * 10000) / 100 : 0;
    const summaryReadRate = totalSent ? Math.round((read / totalSent) * 10000) / 100 : 0;

    return {
      summary: {
        totalSent,
        delivered,
        read,
        failed,
        pending,
        deliveryRate: summaryDeliveryRate,
        readRate: summaryReadRate,
      },
      byDay: base.map((d) => map.get(d.date)!),
    };
  }

  async getRecentActivity(organizationId: string, limit = 10): Promise<RecentActivityItem[]> {
    const items: RecentActivityItem[] = [];

    const [recentMessages, recentCampaigns, recentContacts] = await Promise.all([
      prisma.message.findMany({
        where: { conversation: { organizationId } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          conversation: {
            include: {
              contact: { select: { firstName: true, lastName: true, phone: true } },
            },
          },
        },
      }),
      prisma.campaign.findMany({
        where: { organizationId },
        orderBy: { updatedAt: 'desc' },
        take: 3,
        select: { id: true, name: true, status: true, updatedAt: true },
      }),
      prisma.contact.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { id: true, firstName: true, lastName: true, phone: true, createdAt: true },
      }),
    ]);

    for (const m of recentMessages) {
      const c = m.conversation?.contact;
      const name = c ? ([c.firstName, c.lastName].filter(Boolean).join(' ') || c.phone) : 'Unknown';

      items.push({
        id: m.id,
        type: 'message',
        action: m.direction === 'OUTBOUND' ? 'message_sent' : 'message_received',
        description: m.direction === 'OUTBOUND' ? `Message sent to ${name}` : `Message received from ${name}`,
        timestamp: m.createdAt.toISOString(),
        metadata: { status: m.status, messageType: m.type },
      });
    }

    for (const c of recentCampaigns) {
      items.push({
        id: c.id,
        type: 'campaign',
        action: `campaign_${String(c.status).toLowerCase()}`,
        description: `Campaign "${c.name}" ${String(c.status).toLowerCase()}`,
        timestamp: c.updatedAt.toISOString(),
        metadata: { status: c.status },
      });
    }

    for (const c of recentContacts) {
      const name = ([c.firstName, c.lastName].filter(Boolean).join(' ') || c.phone);
      items.push({
        id: c.id,
        type: 'contact',
        action: 'contact_added',
        description: `New contact added: ${name}`,
        timestamp: c.createdAt.toISOString(),
      });
    }

    return items
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  // --- Main Widget Method ---
  async getDashboardWidgets(organizationId: string, days = 7) {
    const [messagesOverview, delivery, recentActivity] = await Promise.all([
      this.getMessagesOverview(organizationId, days),
      this.getDeliveryPerformance(organizationId, days),
      this.getRecentActivity(organizationId, 10),
    ]);

    return {
      days,
      messagesOverview,
      deliveryPerformance: delivery.summary,
      deliveryByDay: delivery.byDay,
      recentActivity,
    };
  }

  // --- Other existing methods (Stats, QuickStats etc.) ---
  
  async getDashboardStats(userId: string, organizationId: string) {
    const today = new Date();
    const last30Days = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last24Hours = new Date(today.getTime() - 24 * 60 * 60 * 1000);

    const [
      totalContacts,
      messagesSent,
      messagesReceived,
      activeCampaigns,
      activeConversations,
      templatesCount,
      chatbotsCount
    ] = await Promise.all([
      prisma.contact.count({ where: { organizationId } }),
      prisma.message.count({ where: { conversation: { organizationId }, direction: 'OUTBOUND', createdAt: { gte: last30Days } } }),
      prisma.message.count({ where: { conversation: { organizationId }, direction: 'INBOUND', createdAt: { gte: last30Days } } }),
      prisma.campaign.count({ where: { organizationId, status: 'RUNNING' } }),
      prisma.conversation.count({ where: { organizationId, lastMessageAt: { gte: last24Hours } } }),
      prisma.template.count({ where: { organizationId } }),
      prisma.chatbot.count({ where: { organizationId } })
    ]);

    return {
      stats: {
        totalContacts,
        messagesSent,
        messagesReceived,
        activeCampaigns,
        activeConversations,
        templatesCount,
        chatbotsCount
      }
    };
  }

  async getQuickStats(organizationId: string) {
    const unreadConversations = await prisma.conversation.count({
      where: { organizationId, isRead: false, isArchived: false }
    });

    const pendingCampaigns = await prisma.campaign.count({
      where: { organizationId, status: 'SCHEDULED' }
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMessages = await prisma.message.count({
      where: { conversation: { organizationId }, createdAt: { gte: today } }
    });

    return { unreadConversations, pendingCampaigns, todayMessages };
  }

  async getChartData(organizationId: string, days: number) {
    // Reusing logic from getMessagesOverview
    const data = await this.getMessagesOverview(organizationId, days);
    return data.map(d => ({
      date: d.date,
      label: d.label,
      sent: d.sent,
      received: d.received,
      delivered: d.sent // simplified for chart-data endpoint
    }));
  }
}

export const dashboardService = new DashboardService();