"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
// src/utils/logger.ts
const config_1 = require("../config");
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["ERROR"] = 0] = "ERROR";
    LogLevel[LogLevel["WARN"] = 1] = "WARN";
    LogLevel[LogLevel["INFO"] = 2] = "INFO";
    LogLevel[LogLevel["DEBUG"] = 3] = "DEBUG";
})(LogLevel || (LogLevel = {}));
class Logger {
    level;
    constructor() {
        this.level = config_1.config.app.isProduction ? LogLevel.INFO : LogLevel.DEBUG;
    }
    formatMessage(level, message, meta) {
        const timestamp = new Date().toISOString();
        return JSON.stringify({
            timestamp,
            level,
            message,
            ...(meta || {}),
        });
    }
    error(message, error, meta) {
        if (this.level >= LogLevel.ERROR) {
            console.error(this.formatMessage('ERROR', message, {
                ...meta,
                error: error?.message || error,
                stack: error?.stack,
            }));
        }
    }
    warn(message, meta) {
        if (this.level >= LogLevel.WARN) {
            console.warn(this.formatMessage('WARN', message, meta));
        }
    }
    info(message, meta) {
        if (this.level >= LogLevel.INFO) {
            console.info(this.formatMessage('INFO', message, meta));
        }
    }
    debug(message, meta) {
        if (this.level >= LogLevel.DEBUG) {
            console.debug(this.formatMessage('DEBUG', message, meta));
        }
    }
}
exports.logger = new Logger();
exports.default = exports.logger;
//# sourceMappingURL=logger.js.map