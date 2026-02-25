// prisma/seed.ts

import { PrismaClient, PlanType } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Use DIRECT_URL for seeding to avoid PgBouncer prepared statement issues
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

  console.log('🌱 Starting database seeding...');

  // ============================================
  // 1. SEED PLANS
  // ============================================
  console.log('📦 Seeding Plans...');

  const plans = [
    {
      name: 'Free Demo',
      type: PlanType.FREE_DEMO,
      slug: 'free-demo',
      description: '2-day trial with basic features to test the platform',
      monthlyPrice: 0,
      yearlyPrice: 0,
      validityDays: 2,
      maxContacts: 50,
      maxMessages: 100,
      maxMessagesPerMonth: 100,
      maxTeamMembers: 1,
      maxCampaigns: 1,
      maxCampaignsPerMonth: 1,
      maxChatbots: 0,
      maxTemplates: 2,
      maxWhatsAppAccounts: 1,
      maxAutomations: 0,
      maxApiCalls: 0,
      isActive: true,
      features: [
        '100 messages',
        '1 campaign',
        '50 contacts',
        '2-day trial period'
      ],
    },
    {
      name: 'Monthly Plan',
      type: PlanType.MONTHLY,
      slug: 'monthly',
      description: 'Perfect for small businesses getting started',
      monthlyPrice: 899,
      yearlyPrice: 899,
      validityDays: 30,
      maxContacts: 999999,
      maxMessages: 999999,
      maxMessagesPerMonth: 999999,
      maxTeamMembers: 3,
      maxCampaigns: 999999,
      maxCampaignsPerMonth: 999999,
      maxChatbots: 2,
      maxTemplates: 999999,
      maxWhatsAppAccounts: 1,
      maxAutomations: 0,
      maxApiCalls: 5000,
      isActive: true,
      features: [
        'Unlimited* messages',
        'Unlimited campaigns',
        'Unlimited contacts',
        '1 WhatsApp account'
      ],
    },
    {
      name: '3-Month Plan',
      type: PlanType.QUARTERLY,
      slug: '3-month',
      description: 'Save ₹197 with quarterly billing',
      monthlyPrice: 2500,
      yearlyPrice: 2500,
      validityDays: 90,
      maxContacts: 999999,
      maxMessages: 999999,
      maxMessagesPerMonth: 999999,
      maxTeamMembers: 5,
      maxCampaigns: 999999,
      maxCampaignsPerMonth: 999999,
      maxChatbots: 5,
      maxTemplates: 999999,
      maxWhatsAppAccounts: 1,
      maxAutomations: 10,
      maxApiCalls: 10000,
      isActive: true,
      features: [
        'Unlimited* messages',
        'Unlimited campaigns',
        'Standard support',
        'Save 7% vs monthly'
      ],
    },
    {
      name: '6-Month Plan ⭐',
      type: PlanType.BIANNUAL,
      slug: '6-month',
      description: 'Most popular - Best value with premium features',
      monthlyPrice: 5000,
      yearlyPrice: 5000,
      validityDays: 180,
      maxContacts: 999999,
      maxMessages: 999999,
      maxMessagesPerMonth: 999999,
      maxTeamMembers: 10,
      maxCampaigns: 999999,
      maxCampaignsPerMonth: 999999,
      maxChatbots: 10,
      maxTemplates: 999999,
      maxWhatsAppAccounts: 1,
      maxAutomations: 50,
      maxApiCalls: 25000,
      isActive: true,
      isRecommended: true,
      features: [
        'Advanced automation',
        'Campaign retry ✅',
        'Priority support',
        'Save 15% vs monthly'
      ],
    },
    {
      name: '1-Year Plan ⭐',
      type: PlanType.ANNUAL,
      slug: '1-year',
      description: 'Best value - Maximum savings with all features',
      monthlyPrice: 8999,
      yearlyPrice: 8999,
      validityDays: 365,
      maxContacts: 999999,
      maxMessages: 999999,
      maxMessagesPerMonth: 999999,
      maxTeamMembers: 999999,
      maxCampaigns: 999999,
      maxCampaignsPerMonth: 999999,
      maxChatbots: 999999,
      maxTemplates: 999999,
      maxWhatsAppAccounts: 2,
      maxAutomations: 999999,
      maxApiCalls: 100000,
      isActive: true,
      isRecommended: true,
      features: [
        'Full automation',
        '2 WhatsApp accounts',
        'Maximum savings',
        'Priority support'
      ],
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { type: plan.type },
      update: plan,
      create: plan,
    });
    console.log(`   ✅ Plan "${plan.name}" (${plan.type})`);
  }

  // ============================================
  // 2. SEED ADMIN USERS
  // ============================================
  console.log('\n👤 Seeding Admin Users...');

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

  console.log('\n🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });