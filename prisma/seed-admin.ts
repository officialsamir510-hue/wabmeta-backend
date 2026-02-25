// prisma/seed-admin.ts

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const databaseUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: databaseUrl,
        },
    },
});

async function main() {
    await prisma.$connect();

    console.log('👤 Seeding Admin Users...');

    const adminPassword = 'SuperAdmin@123';
    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    const admins = [
        {
            email: 'admin@wabmeta.com',
            password: hashedPassword,
            name: 'Super Admin',
            role: 'super_admin',
            isActive: true,
        },
        {
            email: 'support@wabmeta.com',
            password: await bcrypt.hash('Support@123', 12),
            name: 'Support Admin',
            role: 'admin',
            isActive: true,
        }
    ];

    for (const admin of admins) {
        const user = await prisma.adminUser.upsert({
            where: { email: admin.email },
            update: admin,
            create: admin,
        });
        console.log(`   ✅ Admin created: ${user.email}`);
    }

    console.log('\n🎉 Admin seeding completed!');
}

main()
    .catch((e) => {
        console.error('❌ Admin seeding failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
