import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Subscription Plans:
 * 
 * 1. Starter: $699/month - 10 users, $119 per extra user
 * 2. Growth: $1,199/month - 25 users, $100 per extra user
 * 3. Pro: $2,999/month - Unlimited users
 * 4. Enterprise Lifetime: $24,999 one-time for 4 years, then reverts to Pro at $2,999/month
 */

async function seedSubscriptionPlans() {
  console.log('🌱 Seeding subscription plans...');

  // Calculate Enterprise Lifetime savings
  const proMonthlyPrice = 2999;
  const lifetimeDurationYears = 4;
  const lifetimeDurationMonths = lifetimeDurationYears * 12;
  const totalProCostFor4Years = proMonthlyPrice * lifetimeDurationMonths; // $143,952
  const lifetimePrice = 24999;
  const savings = totalProCostFor4Years - lifetimePrice; // $118,953
  const savingsPercentage = ((savings / totalProCostFor4Years) * 100).toFixed(1); // 82.6%

  console.log(`💰 Enterprise Lifetime Calculation:`);
  console.log(`   - Pro Plan: $${proMonthlyPrice}/month`);
  console.log(`   - 4 Years (${lifetimeDurationMonths} months): $${totalProCostFor4Years.toLocaleString()}`);
  console.log(`   - Lifetime Price: $${lifetimePrice.toLocaleString()}`);
  console.log(`   - Total Savings: $${savings.toLocaleString()} (${savingsPercentage}%)`);
  console.log();

  const plans = [
    {
      name: 'Starter',
      basePrice: 699,
      billingInterval: 'monthly',
      includedUsers: 10,
      extraUserPrice: 119,
      maxVehicles: -1, // Unlimited
      displayOrder: 1,
      features: [
        '10 active posting accounts included',
        'Unlimited vehicle inventory',
        'Auto-sync every 3 hours',
        'Facebook Groups posting',
        'Personal Marketplace posting (Chrome Extension)',
        'AI-powered descriptions',
        'Custom templates',
        'Email notifications',
        'Standard support',
        '$119 per additional user',
      ],
    },
    {
      name: 'Growth',
      basePrice: 1199,
      billingInterval: 'monthly',
      includedUsers: 25,
      extraUserPrice: 100,
      maxVehicles: -1, // Unlimited
      displayOrder: 2,
      features: [
        '25 active posting accounts included',
        'Unlimited vehicle inventory',
        'Auto-sync every 3 hours',
        'Facebook Groups posting',
        'Personal Marketplace posting (Chrome Extension)',
        'AI-powered descriptions',
        'Custom templates',
        'Email notifications',
        'Priority support',
        '$100 per additional user',
      ],
    },
    {
      name: 'Pro',
      basePrice: 2999,
      billingInterval: 'monthly',
      includedUsers: -1, // Unlimited
      extraUserPrice: 0,
      maxVehicles: -1, // Unlimited
      displayOrder: 3,
      features: [
        'Unlimited active posting accounts',
        'Unlimited vehicle inventory',
        'Auto-sync every 3 hours',
        'Facebook Groups posting',
        'Personal Marketplace posting (Chrome Extension)',
        'AI-powered descriptions',
        'Custom templates',
        'Email notifications',
        'Premium support',
        'White-label options',
        'API access',
      ],
    },
    {
      name: 'Enterprise Lifetime',
      basePrice: 24999,
      billingInterval: 'lifetime',
      includedUsers: -1, // Unlimited
      extraUserPrice: 0,
      maxVehicles: -1, // Unlimited
      lifetimeDuration: 4, // 4 years
      renewalPrice: 24999, // Same price to renew for another 4 years
      displayOrder: 4,
      features: [
        `4 years of unlimited access`,
        `Save $${savings.toLocaleString()} (${savingsPercentage}%) vs Pro plan`,
        'Unlimited active posting accounts',
        'Unlimited vehicle inventory',
        'Auto-sync every 3 hours',
        'Facebook Groups posting',
        'Personal Marketplace posting (Chrome Extension)',
        'AI-powered descriptions',
        'Custom templates',
        'Email notifications',
        'Premium support',
        'White-label options',
        'API access',
        'Dedicated account manager',
        `After 4 years, reverts to Pro plan ($${proMonthlyPrice}/month)`,
        `Renew for another 4 years at $${lifetimePrice.toLocaleString()}`,
      ],
    },
  ];

  // First, create Pro plan (needed for reversion reference)
  const proPlan = await prisma.subscriptionPlan.upsert({
    where: { name: 'Pro' },
    create: plans[2],
    update: plans[2],
  });

  console.log(`✅ Created/Updated: Pro Plan`);

  // Create/update other plans
  for (const plan of [plans[0], plans[1]]) {
    await prisma.subscriptionPlan.upsert({
      where: { name: plan.name },
      create: plan,
      update: plan,
    });
    console.log(`✅ Created/Updated: ${plan.name} Plan`);
  }

  // Create Enterprise Lifetime with reversion to Pro
  await prisma.subscriptionPlan.upsert({
    where: { name: 'Enterprise Lifetime' },
    create: {
      ...plans[3],
      revertToPlanId: proPlan.id,
    },
    update: {
      ...plans[3],
      revertToPlanId: proPlan.id,
    },
  });

  console.log(`✅ Created/Updated: Enterprise Lifetime Plan (reverts to Pro)`);
  console.log();
  console.log('🎉 Subscription plans seeded successfully!');
  console.log();
  console.log('📋 Plan Summary:');
  console.log(`   1. Starter:            $699/mo  (10 users + $119 per extra)`);
  console.log(`   2. Growth:             $1,199/mo (25 users + $100 per extra)`);
  console.log(`   3. Pro:                $2,999/mo (unlimited users)`);
  console.log(`   4. Enterprise Lifetime: $24,999 one-time (4 years, saves $${savings.toLocaleString()})`);
  console.log();
}

async function main() {
  try {
    await seedSubscriptionPlans();
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
