import Bull from 'bull';
import { EventEmitter } from 'events';
export declare const messageQueue: Bull.Queue<any>;
export declare const addMessage: (data: any) => Promise<Bull.Job<any>>;
export declare const getQueueStats: () => Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    total: number;
    pending: number;
    processing: number;
    sent: number;
}>;
/**
 * messageQueueWorker object to maintain compatibility with server.ts and routes
 */
export declare const messageQueueWorker: EventEmitter<any> & {
    isRunning: boolean;
    start: () => Promise<void>;
    stop: () => Promise<void>;
    addToQueue: (data: any) => Promise<Bull.Job<any>>;
    getQueueStats: () => Promise<{
        waiting: number;
        active: number;
        completed: number;
        failed: number;
        delayed: number;
        total: number;
        pending: number;
        processing: number;
        sent: number;
    }>;
    retryFailedMessages: (campaignId?: string) => Promise<number>;
    clearFailedMessages: () => Promise<number>;
    getHealthStatus: () => Promise<{
        status: string;
        healthy: boolean;
        stats: {
            waiting: number;
            active: number;
            completed: number;
            failed: number;
            delayed: number;
            total: number;
            pending: number;
            processing: number;
            sent: number;
        };
        timestamp: Date;
    }>;
    whatsappQueue: Bull.Queue<any>;
};
export declare const addToWhatsAppQueue: (data: any) => Promise<Bull.Job<any>>;
export default messageQueue;
//# sourceMappingURL=messageQueue.service.d.ts.map