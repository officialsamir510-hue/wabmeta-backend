// ✅ OPTIMIZED: src/services/scheduler.service.ts

import cron from 'node-cron';
import { automationEngine } from '../modules/automation/automation.engine';

export function initializeScheduler() {
  console.log('⏰ Initializing automation scheduler...');

  // ✅ OPTIMIZED: Run scheduled automations every 5 minutes (was every 1 minute)
  // This reduces Redis/DB load significantly while still being accurate enough
  cron.schedule('*/5 * * * *', async () => {
    try {
      await automationEngine.triggerScheduled();
    } catch (error) {
      console.error('Scheduled automation error:', error);
    }
  });

  // ✅ OPTIMIZED: Check for inactive contacts every 4 hours (was every 1 hour)
  // Inactivity is measured in hours/days, so checking every 4h is sufficient
  cron.schedule('0 */4 * * *', async () => {
    try {
      await automationEngine.triggerInactivity();
    } catch (error) {
      console.error('Inactivity automation error:', error);
    }
  });

  console.log('✅ Automation scheduler initialized');
}
