// prisma/seed.ts

import { PrismaClient, PlanType } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Use DIRECT_URL for seeding to avoid PgBouncer prepared statement issues
// PgBouncer in transaction mode doesn't support prepared statements
const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
  log: ['error', 'warn'],
});

async function main() {
  // Ensure database connection is established
  await prisma.$connect();

  console.log('🌱 Starting database seeding...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // ============================================
  // 1. SEED PLANS
  // ============================================
  console.log('\n📦 Seeding Plans...');

  const plans = [
    {
      name: 'Free',
      slug: 'free',
      type: PlanType.FREE,
      description: 'Perfect for getting started',
      monthlyPrice: 0,
      yearlyPrice: 0,
      maxContacts: 100,
      maxMessages: 1000,
      maxTeamMembers: 1,
      maxCampaigns: 5,
      maxChatbots: 1,
      maxTemplates: 5,
      maxWhatsAppAccounts: 1,
      maxMessagesPerMonth: 1000,
      maxCampaignsPerMonth: 5,
      maxAutomations: 1,
      maxApiCalls: 1000,
      features: [
        'Basic messaging',
        'Contact management',
        'Single user',
        '1 WhatsApp number',
      ],
      isActive: true,
    },
    {
      name: 'Starter',
      slug: 'starter',
      type: PlanType.STARTER,
      description: 'For small businesses',
      monthlyPrice: 29,
      yearlyPrice: 290,
      maxContacts: 1000,
      maxMessages: 10000,
      maxTeamMembers: 3,
      maxCampaigns: 20,
      maxChatbots: 3,
      maxTemplates: 20,
      maxWhatsAppAccounts: 2,
      maxMessagesPerMonth: 10000,
      maxCampaignsPerMonth: 20,
      maxAutomations: 5,
      maxApiCalls: 10000,
      features: [
        'Everything in Free',
        'Campaign scheduling',
        'Basic analytics',
        'Email support',
        '2 WhatsApp numbers',
      ],
      isActive: true,
    },
    {
      name: 'Pro',
      slug: 'pro',
      type: PlanType.PRO,
      description: 'For growing teams',
      monthlyPrice: 79,
      yearlyPrice: 790,
      maxContacts: 10000,
      maxMessages: 50000,
      maxTeamMembers: 10,
      maxCampaigns: 100,
      maxChatbots: 10,
      maxTemplates: 50,
      maxWhatsAppAccounts: 5,
      maxMessagesPerMonth: 50000,
      maxCampaignsPerMonth: 100,
      maxAutomations: 20,
      maxApiCalls: 50000,
      features: [
        'Everything in Starter',
        'Advanced chatbot builder',
        'Automation workflows',
        'Analytics dashboard',
        'Priority support',
        'API access',
        '5 WhatsApp numbers',
      ],
      isActive: true,
    },
    {
      name: 'Enterprise',
      slug: 'enterprise',
      type: PlanType.ENTERPRISE,
      description: 'For large organizations',
      monthlyPrice: 199,
      yearlyPrice: 1990,
      maxContacts: 100000,
      maxMessages: 500000,
      maxTeamMembers: 50,
      maxCampaigns: 500,
      maxChatbots: 50,
      maxTemplates: 200,
      maxWhatsAppAccounts: 999999,
      maxMessagesPerMonth: 500000,
      maxCampaignsPerMonth: 500,
      maxAutomations: 100,
      maxApiCalls: 999999,
      features: [
        'Everything in Pro',
        'Unlimited team members',
        'Custom integrations',
        'Dedicated support',
        'SLA guarantee',
        'Custom branding',
        'Unlimited WhatsApp numbers',
        'White-label options',
      ],
      isActive: true,
    },
  ];

  for (const plan of plans) {
    try {
      const result = await prisma.plan.upsert({
        where: { type: plan.type },
        update: {
          ...plan,
          features: plan.features,
        },
        create: {
          ...plan,
          features: plan.features,
        },
      });
      console.log(`   ✅ Plan "${result.name}" (${result.type})`);
    } catch (error: any) {
      console.error(`   ❌ Failed to seed plan "${plan.name}":`, error.message);
      // Continue with other plans even if one fails
    }
  }

  console.log('   📦 All plans seeded successfully!');

  // ============================================
  // 2. SEED SUPER ADMIN
  // ============================================
  console.log('\n👤 Seeding Super Admin...');

  const adminPassword = 'SuperAdmin@123';
  const hashedPassword = await bcrypt.hash(adminPassword, 12);

  try {
    const superAdmin = await prisma.adminUser.upsert({
      where: { email: 'admin@wabmeta.com' },
      update: {
        password: hashedPassword,
        name: 'Super Admin',
        role: 'super_admin',
        isActive: true,
      },
      create: {
        email: 'admin@wabmeta.com',
        password: hashedPassword,
        name: 'Super Admin',
        role: 'super_admin',
        isActive: true,
      },
    });

    console.log(`   ✅ Super Admin created: ${superAdmin.email}`);
    console.log(`   📧 Email: admin@wabmeta.com`);
    console.log(`   🔑 Password: ${adminPassword}`);
  } catch (error: any) {
    console.error(`   ❌ Failed to seed Super Admin:`, error.message);
  }

  // ============================================
  // 3. SEED ADDITIONAL ADMIN (Optional)
  // ============================================
  console.log('\n👤 Seeding Additional Admin...');

  const supportPassword = 'Support@123';
  const supportHashedPassword = await bcrypt.hash(supportPassword, 12);

  try {
    const supportAdmin = await prisma.adminUser.upsert({
      where: { email: 'support@wabmeta.com' },
      update: {
        password: supportHashedPassword,
        name: 'Support Admin',
        role: 'admin',
        isActive: true,
      },
      create: {
        email: 'support@wabmeta.com',
        password: supportHashedPassword,
        name: 'Support Admin',
        role: 'admin',
        isActive: true,
      },
    });

    console.log(`   ✅ Support Admin created: ${supportAdmin.email}`);
    console.log(`   📧 Email: support@wabmeta.com`);
    console.log(`   🔑 Password: ${supportPassword}`);
  } catch (error: any) {
    console.error(`   ❌ Failed to seed Support Admin:`, error.message);
  }

  // ============================================
  // 4. SUMMARY
  // ============================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 Database seeding completed successfully!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n📋 Summary:');
  console.log(`   • ${plans.length} Plans created`);
  console.log(`   • 2 Admin users created`);
  console.log('\n🔐 Admin Login Credentials:');
  console.log('   ┌─────────────────────────────────────────┐');
  console.log('   │ Super Admin                             │');
  console.log('   │ Email: admin@wabmeta.com                │');
  console.log('   │ Password: SuperAdmin@123                │');
  console.log('   ├─────────────────────────────────────────┤');
  console.log('   │ Support Admin                           │');
  console.log('   │ Email: support@wabmeta.com              │');
  console.log('   │ Password: Support@123                   │');
  console.log('   └─────────────────────────────────────────┘');
  console.log('\n🌐 Access admin panel at: /admin/login\n');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });