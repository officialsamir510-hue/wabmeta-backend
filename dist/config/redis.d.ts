import Redis from 'ioredis';
export declare const initRedis: () => Redis | null;
export declare const getRedis: () => Redis | null;
export declare const closeRedis: () => Promise<void>;
declare const _default: {
    initRedis: () => Redis | null;
    getRedis: () => Redis | null;
    closeRedis: () => Promise<void>;
};
export default _default;
//# sourceMappingURL=redis.d.ts.map