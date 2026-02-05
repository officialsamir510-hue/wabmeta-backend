// prisma/seed.ts

import { PrismaClient, PlanType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // ============================================
  // 1. SEED PLANS
  // ============================================
  console.log('\n📦 Seeding Plans...');

  const plans = [
    {
      name: 'Free',
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
  }

  console.log('   📦 All plans seeded successfully!');

  // ============================================
  // 2. SEED SUPER ADMIN
  // ============================================
  console.log('\n👤 Seeding Super Admin...');

  const adminPassword = 'SuperAdmin@123';
  const hashedPassword = await bcrypt.hash(adminPassword, 12);

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

  // ============================================
  // 3. SEED ADDITIONAL ADMIN (Optional)
  // ============================================
  console.log('\n👤 Seeding Additional Admin...');

  const supportPassword = 'Support@123';
  const supportHashedPassword = await bcrypt.hash(supportPassword, 12);

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