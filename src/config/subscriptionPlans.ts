/**
 * Subscription Plans Configuration
 * Dealers Face - Auto Dealer Facebook Marketplace Automation
 * 
 * 4-Tier Subscription Model:
 * - Starter: $699/month (10 accounts, $119/extra user)
 * - Growth: $1,199/month (25 accounts, $100/extra user)
 * - Pro: $2,999/month (Unlimited accounts, no extra fees)
 * - Enterprise Lifetime: $24,999 one-time (4 years unlimited)
 */

export interface SubscriptionPlanConfig {
  name: string;
  slug: string;
  description: string;
  basePrice: number;
  billingInterval: 'monthly' | 'yearly' | 'lifetime';
  includedUsers: number; // -1 = unlimited
  extraUserPrice: number;
  maxVehicles: number; // -1 = unlimited
  maxPosts: number; // -1 = unlimited
  features: string[];
  isPopular: boolean;
  displayOrder: number;
  // Lifetime plan specifics
  lifetimeDuration?: number; // years
  renewalPrice?: number;
  revertToPlanSlug?: string;
  // Stripe IDs (to be set after creating products in Stripe)
  stripeProductId?: string;
  stripePriceId?: string;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlanConfig[] = [
  {
    name: 'Starter',
    slug: 'starter',
    description: 'Perfect for small to mid-size dealerships getting started with Facebook Marketplace automation. Includes 10 active posting accounts and all essential features.',
    basePrice: 699,
    billingInterval: 'monthly',
    includedUsers: 10,
    extraUserPrice: 119,
    maxVehicles: -1, // unlimited
    maxPosts: -1, // unlimited
    features: [
      'Up to 10 active posting accounts',
      'Unlimited vehicle inventory',
      'Facebook Marketplace integration',
      'DMS/FTP auto-sync',
      'Chrome extension access',
      'Lead capture & management',
      'ADF/XML lead export',
      'Basic analytics & reporting',
      'Email support (48hr response)',
      'Knowledge base access',
      '$119 per additional user',
    ],
    isPopular: false,
    displayOrder: 1,
  },
  {
    name: 'Growth',
    slug: 'growth',
    description: 'Ideal for growing dealerships with multiple sales team members. Includes 25 active posting accounts with priority support.',
    basePrice: 1199,
    billingInterval: 'monthly',
    includedUsers: 25,
    extraUserPrice: 100,
    maxVehicles: -1,
    maxPosts: -1,
    features: [
      'Up to 25 active posting accounts',
      'All Starter features included',
      'Multi-location management',
      'Advanced analytics dashboard',
      'Priority email support (24hr)',
      'Phone support (business hours)',
      'Custom posting schedules',
      'Performance reports',
      'Team activity tracking',
      '$100 per additional user',
    ],
    isPopular: true,
    displayOrder: 2,
  },
  {
    name: 'Pro',
    slug: 'pro',
    description: 'For large dealer groups and high-volume operations. Unlimited posting accounts with premium support and full API access.',
    basePrice: 2999,
    billingInterval: 'monthly',
    includedUsers: -1, // unlimited
    extraUserPrice: 0,
    maxVehicles: -1,
    maxPosts: -1,
    features: [
      'Unlimited posting accounts',
      'Unlimited users - no extra fees',
      'All Growth features included',
      'Full REST API access',
      'Custom integrations support',
      'Dedicated account manager',
      'Premium support (4hr response)',
      '24/7 phone support',
      'Custom reporting & analytics',
      'White-label options available',
      'SLA guarantee (99.9% uptime)',
      'Onboarding & training included',
    ],
    isPopular: false,
    displayOrder: 3,
  },
  {
    name: 'Enterprise Lifetime',
    slug: 'enterprise-lifetime',
    description: 'Best value for committed dealers. One-time payment for 4 years of unlimited access. Saves $118,953 (82.6% savings vs Pro plan over 4 years).',
    basePrice: 24999,
    billingInterval: 'lifetime',
    includedUsers: -1, // unlimited
    extraUserPrice: 0,
    maxVehicles: -1,
    maxPosts: -1,
    lifetimeDuration: 4, // 4 years
    renewalPrice: 2999, // Reverts to Pro pricing after 4 years
    revertToPlanSlug: 'pro',
    features: [
      '4 years of unlimited access',
      'All Pro features included',
      'Unlimited posting accounts',
      'Unlimited users forever',
      'Saves $118,953 over 4 years',
      '82.6% savings vs Pro monthly',
      'Lock in current pricing',
      'Priority feature requests',
      'VIP support status',
      'Executive escalation path',
      'Quarterly business reviews',
      'After 4 years: $2,999/month Pro rate',
    ],
    isPopular: false,
    displayOrder: 4,
  },
];

/**
 * Calculate savings for Enterprise Lifetime plan
 */
export function calculateLifetimeSavings() {
  const proMonthlyPrice = 2999;
  const lifetimePrice = 24999;
  const lifetimeYears = 4;
  
  const totalProCost = proMonthlyPrice * 12 * lifetimeYears; // $143,952
  const savings = totalProCost - lifetimePrice; // $118,953
  const savingsPercentage = ((savings / totalProCost) * 100).toFixed(1); // 82.6%
  
  return {
    proMonthlyPrice,
    lifetimePrice,
    lifetimeYears,
    totalProCost,
    savings,
    savingsPercentage,
  };
}

/**
 * Get plan by slug
 */
export function getPlanBySlug(slug: string): SubscriptionPlanConfig | undefined {
  return SUBSCRIPTION_PLANS.find(p => p.slug === slug);
}

/**
 * Get plan by name
 */
export function getPlanByName(name: string): SubscriptionPlanConfig | undefined {
  return SUBSCRIPTION_PLANS.find(p => p.name.toLowerCase() === name.toLowerCase());
}

/**
 * Calculate extra user charges for a given plan and user count
 */
export function calculateExtraUserCharge(planSlug: string, totalUsers: number): {
  includedUsers: number;
  extraUsers: number;
  extraUserPrice: number;
  totalExtraCharge: number;
} {
  const plan = getPlanBySlug(planSlug);
  if (!plan || plan.includedUsers === -1) {
    return {
      includedUsers: plan?.includedUsers || -1,
      extraUsers: 0,
      extraUserPrice: 0,
      totalExtraCharge: 0,
    };
  }
  
  const extraUsers = Math.max(0, totalUsers - plan.includedUsers);
  const totalExtraCharge = extraUsers * plan.extraUserPrice;
  
  return {
    includedUsers: plan.includedUsers,
    extraUsers,
    extraUserPrice: plan.extraUserPrice,
    totalExtraCharge,
  };
}

/**
 * Format price for display
 */
export function formatPrice(amount: number, showCents: boolean = false): string {
  if (showCents) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Get billing interval display text
 */
export function getBillingIntervalText(interval: string): string {
  switch (interval) {
    case 'monthly':
      return '/month';
    case 'yearly':
      return '/year';
    case 'lifetime':
      return ' one-time';
    default:
      return '';
  }
}

export default SUBSCRIPTION_PLANS;
