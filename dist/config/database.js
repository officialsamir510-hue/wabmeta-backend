"use strict";
// src/config/database.ts
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const createPrismaClient = () => {
    const client = new client_1.PrismaClient({
        log: process.env.NODE_ENV === 'development'
            ? ['query', 'error', 'warn']
            : ['error'],
    });
    // ✅ Add connection retry logic
    client.$connect()
        .then(() => console.log('✅ Database connected'))
        .catch((err) => {
        console.error('❌ Database connection failed:', err);
        // Retry after 5 seconds
        setTimeout(() => {
            client.$connect().catch(console.error);
        }, 5000);
    });
    return client;
};
const prisma = globalThis.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== 'production') {
    globalThis.prisma = prisma;
}
// Graceful shutdown
const shutdown = async () => {
    console.log('🔌 Disconnecting database...');
    await prisma.$disconnect();
};
process.on('beforeExit', shutdown);
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
exports.default = prisma;
//# sourceMappingURL=database.js.map