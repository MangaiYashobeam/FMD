/**
 * Seed Subscription Plans
 * Run with: npx ts-node prisma/seed-plans.ts
 */

import { PrismaClient } from '@prisma/client';
import { SUBSCRIPTION_PLANS } from '../src/config/subscriptionPlans';

const prisma = new PrismaClient();

async function seedSubscriptionPlans() {
  console.log('🌱 Seeding subscription plans...\n');

  for (const plan of SUBSCRIPTION_PLANS) {
    const existingPlan = await prisma.subscriptionPlan.findUnique({
      where: { slug: plan.slug },
    });

    if (existingPlan) {
      // Update existing plan
      await prisma.subscriptionPlan.update({
        where: { slug: plan.slug },
        data: {
          name: plan.name,
          description: plan.description,
          basePrice: plan.basePrice,
          billingInterval: plan.billingInterval,
          includedUsers: plan.includedUsers,
          extraUserPrice: plan.extraUserPrice,
          maxVehicles: plan.maxVehicles,
          maxPosts: plan.maxPosts,
          features: plan.features,
          isPopular: plan.isPopular,
          displayOrder: plan.displayOrder,
          lifetimeDuration: plan.lifetimeDuration,
          renewalPrice: plan.renewalPrice,
          isActive: true,
        },
      });
      console.log(`  ✅ Updated: ${plan.name}`);
    } else {
      // Create new plan
      await prisma.subscriptionPlan.create({
        data: {
          name: plan.name,
          slug: plan.slug,
          description: plan.description,
          basePrice: plan.basePrice,
          billingInterval: plan.billingInterval,
          includedUsers: plan.includedUsers,
          extraUserPrice: plan.extraUserPrice,
          maxVehicles: plan.maxVehicles,
          maxPosts: plan.maxPosts,
          features: plan.features,
          isPopular: plan.isPopular,
          displayOrder: plan.displayOrder,
          lifetimeDuration: plan.lifetimeDuration,
          renewalPrice: plan.renewalPrice,
          isActive: true,
        },
      });
      console.log(`  ✅ Created: ${plan.name}`);
    }
  }

  // Link Enterprise Lifetime revert plan
  const proPlan = await prisma.subscriptionPlan.findUnique({
    where: { slug: 'pro' },
  });
  
  if (proPlan) {
    await prisma.subscriptionPlan.update({
      where: { slug: 'enterprise-lifetime' },
      data: { revertToPlanId: proPlan.id },
    });
    console.log('\n  🔗 Linked Enterprise Lifetime → Pro revert plan');
  }

  // Deactivate old plans that are no longer in config
  const activeSlugs = SUBSCRIPTION_PLANS.map(p => p.slug);
  await prisma.subscriptionPlan.updateMany({
    where: {
      slug: { notIn: activeSlugs },
    },
    data: { isActive: false },
  });

  console.log('\n✨ Subscription plans seeded successfully!\n');
  
  // Display summary
  console.log('📊 Plan Summary:');
  console.log('================');
  for (const plan of SUBSCRIPTION_PLANS) {
    const price = plan.billingInterval === 'lifetime' 
      ? `$${plan.basePrice.toLocaleString()} one-time`
      : `$${plan.basePrice}/month`;
    const users = plan.includedUsers === -1 
      ? 'Unlimited users'
      : `${plan.includedUsers} users included`;
    const extra = plan.extraUserPrice > 0 
      ? ` (+$${plan.extraUserPrice}/extra)`
      : '';
    console.log(`  ${plan.name}: ${price} - ${users}${extra}`);
  }
}

seedSubscriptionPlans()
  .catch((e) => {
    console.error('❌ Error seeding plans:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
