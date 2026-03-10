// src/services/messageQueue.service.ts - STUB (Bull queue removed)
// Campaigns use direct Meta API sending (campaigns.service.ts → processCampaignContacts)
// This file only exports stubs for backward compatibility with routes/server

import { EventEmitter } from 'events';

// ============================================
// STUB: No Bull queue, no Redis dependency
// ============================================

/**
 * Stub: Get queue statistics (no queue = all zeros)
 */
export const getQueueStats = async () => ({
  waiting: 0,
  active: 0,
  completed: 0,
  failed: 0,
  delayed: 0,
  total: 0,
  pending: 0,
  processing: 0,
  sent: 0,
});

/**
 * Stub: Message Queue Worker compatibility object
 */
export const messageQueueWorker = Object.assign(new EventEmitter(), {
  isRunning: false,

  start: async () => {
    console.log('ℹ️  Message queue disabled (using direct sending)');
  },

  stop: async () => {
    // No-op
  },

  addToQueue: async () => {
    console.warn('⚠️ Bull queue removed. Use direct Meta API sending instead.');
    return null;
  },

  getQueueStats,

  retryFailedMessages: async (_campaignId?: string) => {
    console.log('ℹ️  No queue to retry. Use campaign retry-failed endpoint instead.');
    return 0;
  },

  clearFailedMessages: async () => {
    console.log('ℹ️  No queue to clear.');
    return 0;
  },

  getHealthStatus: async () => ({
    status: 'DISABLED',
    healthy: true,
    message: 'Bull queue removed. Campaigns send directly via Meta API.',
    stats: await getQueueStats(),
    timestamp: new Date(),
  }),

  whatsappQueue: null,
});

export const addToWhatsAppQueue = messageQueueWorker.addToQueue;
export const addMessage = messageQueueWorker.addToQueue;

export default null;