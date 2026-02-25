// src/utils/logger.ts
import { config } from '../config';

enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3,
}

class Logger {
    private level: LogLevel;

    constructor() {
        this.level = config.app.isProduction ? LogLevel.INFO : LogLevel.DEBUG;
    }

    private formatMessage(level: string, message: string, meta?: any) {
        const timestamp = new Date().toISOString();
        return JSON.stringify({
            timestamp,
            level,
            message,
            ...(meta || {}),
        });
    }

    error(message: string, error?: any, meta?: any) {
        if (this.level >= LogLevel.ERROR) {
            console.error(
                this.formatMessage('ERROR', message, {
                    ...meta,
                    error: error?.message || error,
                    stack: error?.stack,
                })
            );
        }
    }

    warn(message: string, meta?: any) {
        if (this.level >= LogLevel.WARN) {
            console.warn(this.formatMessage('WARN', message, meta));
        }
    }

    info(message: string, meta?: any) {
        if (this.level >= LogLevel.INFO) {
            console.info(this.formatMessage('INFO', message, meta));
        }
    }

    debug(message: string, meta?: any) {
        if (this.level >= LogLevel.DEBUG) {
            console.debug(this.formatMessage('DEBUG', message, meta));
        }
    }
}

export const logger = new Logger();
export default logger;
