import { EventEmitter } from 'events';
interface QueueWorkerConfig {
    batchSize: number;
    pollInterval: number;
    maxRetries: number;
    retryDelays: number[];
    concurrentWorkers: number;
}
declare class MessageQueueWorker extends EventEmitter {
    private config;
    private isRunning;
    private workers;
    private stopRequested;
    constructor(config?: Partial<QueueWorkerConfig>);
    start(): Promise<void>;
    stop(): Promise<void>;
    private workerLoop;
    private processNextBatch;
    private processMessage;
    private checkRateLimits;
    private handleFailure;
    private createConversationMessage;
    private parseTemplateParams;
    private sleep;
    addToQueue(data: {
        campaignId?: string;
        contactId: string;
        whatsappAccountId: string;
        templateId: string;
        templateParams?: any;
        priority?: number;
    }): Promise<string>;
    addBatchToQueue(messages: Array<{
        campaignId?: string;
        contactId: string;
        whatsappAccountId: string;
        templateId: string;
        templateParams?: any;
        priority?: number;
    }>): Promise<number>;
    getQueueStats(): Promise<{
        pending: any;
        processing: any;
        sent: any;
        failed: any;
        total: any;
        isRunning: boolean;
        workers: number;
    }>;
    cleanupOldMessages(daysOld?: number): Promise<any>;
    cancelPendingMessages(campaignId: string): Promise<any>;
    retryFailedMessages(campaignId?: string): Promise<any>;
    clearFailedMessages(): Promise<any>;
    getHealthStatus(): Promise<{
        status: string;
        healthy: boolean;
        activeWorkers: number;
        stats: {
            pending: any;
            processing: any;
            sent: any;
            failed: any;
            total: any;
            isRunning: boolean;
            workers: number;
        };
        uptime: number;
        timestamp: Date;
    }>;
}
export declare const messageQueueWorker: MessageQueueWorker;
export default messageQueueWorker;
//# sourceMappingURL=messageQueue.service.d.ts.map