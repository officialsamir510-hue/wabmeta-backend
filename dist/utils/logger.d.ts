declare class Logger {
    private level;
    constructor();
    private formatMessage;
    error(message: string, error?: any, meta?: any): void;
    warn(message: string, meta?: any): void;
    info(message: string, meta?: any): void;
    debug(message: string, meta?: any): void;
}
export declare const logger: Logger;
export default logger;
//# sourceMappingURL=logger.d.ts.map