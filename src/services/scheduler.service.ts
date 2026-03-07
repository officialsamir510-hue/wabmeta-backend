// ✅ CREATE: src/services/scheduler.service.ts

import cron from 'node-cron';
import { automationEngine } from '../modules/automation/automation.engine';

export function initializeScheduler() {
  console.log('⏰ Initializing automation scheduler...');

  // Run scheduled automations every minute
  cron.schedule('* * * * *', async () => {
    try {
      await automationEngine.triggerScheduled();
    } catch (error) {
      console.error('Scheduled automation error:', error);
    }
  });

  // Check for inactive contacts every hour
  cron.schedule('0 * * * *', async () => {
    try {
      await automationEngine.triggerInactivity();
    } catch (error) {
      console.error('Inactivity automation error:', error);
    }
  });

  console.log('✅ Automation scheduler initialized');
}
