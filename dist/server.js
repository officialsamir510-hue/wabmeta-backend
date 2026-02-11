"use strict";
// src/server.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const app_1 = __importDefault(require("./app"));
const config_1 = require("./config");
const socket_1 = require("./socket");
const database_1 = __importDefault(require("./config/database"));
async function bootstrap() {
    try {
        // Test database connection
        await database_1.default.$connect();
        console.log('✅ Database connected successfully');
        // Create HTTP server
        const server = http_1.default.createServer(app_1.default);
        // Initialize Socket.io
        (0, socket_1.initializeSocket)(server);
        console.log('✅ Socket.io initialized');
        // Start server
        server.listen(config_1.config.port, () => {
            console.log(`
🚀 Server is running!
📡 API: http://localhost:${config_1.config.port}
🌍 Environment: ${config_1.config.nodeEnv}
      `);
        });
        // Graceful shutdown
        const shutdown = async () => {
            console.log('\n🔄 Shutting down gracefully...');
            server.close(async () => {
                await database_1.default.$disconnect();
                console.log('✅ Database disconnected');
                process.exit(0);
            });
            // Force close after 10 seconds
            setTimeout(() => {
                console.error('⚠️ Forcing shutdown...');
                process.exit(1);
            }, 10000);
        };
        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    }
    catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}
bootstrap();
//# sourceMappingURL=server.js.map