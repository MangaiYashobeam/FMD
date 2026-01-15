import Stripe from 'stripe';
import { logger } from '@/utils/logger';
import prisma from '@/config/database';
import { AppError } from '@/middleware/errorHandler';

/**
 * Stripe Payment Service
 * Handles all Stripe API interactions and subscription management
 */

export class StripeService {
  private stripe: Stripe;

  constructor() {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }

    this.stripe = new Stripe(apiKey, {
      apiVersion: '2025-02-24.acacia',
    });
  }

  /**
   * Create or retrieve Stripe customer for account
   */
  async getOrCreateCustomer(accountId: string) {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        accountUsers: {
          where: { role: 'ACCOUNT_OWNER' },
          include: { user: true },
        },
      },
    });

    if (!account) {
      throw new AppError('Account not found', 404);
    }

    // Return existing customer
    if (account.stripeCustomerId) {
      return await this.stripe.customers.retrieve(account.stripeCustomerId);
    }

    // Create new customer
    const ownerUser = account.accountUsers[0]?.user;
    const customer = await this.stripe.customers.create({
      email: ownerUser?.email,
      name: account.dealershipName || account.name,
      phone: account.phone || undefined,
      metadata: {
        accountId: account.id,
        dealershipName: account.dealershipName || '',
      },
    });

    // Update account with customer ID
    await prisma.account.update({
      where: { id: accountId },
      data: { stripeCustomerId: customer.id },
    });

    logger.info(`Stripe customer created: ${customer.id} for account ${accountId}`);
    return customer;
  }

  /**
   * Create subscription for account
   */
  async createSubscription(accountId: string, planId: string) {
    const customer = await this.getOrCreateCustomer(accountId);
    
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan || !plan.isActive) {
      throw new AppError('Invalid or inactive subscription plan', 400);
    }

    // Handle lifetime plans differently
    if (plan.billingInterval === 'lifetime') {
      return await this.createLifetimeSubscription(accountId, plan);
    }

    // Create monthly subscription
    const subscription = await this.stripe.subscriptions.create({
      customer: customer.id as string,
      items: [{ price: plan.stripePriceId! }],
      metadata: {
        accountId,
        planId: plan.id,
        planName: plan.name,
      },
      trial_period_days: 14, // 14-day trial
    });

    // Update account
    await prisma.account.update({
      where: { id: accountId },
      data: {
        subscriptionPlanId: plan.id,
        subscriptionStatus: 'active',
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
      },
    });

    // Log subscription history
    await prisma.subscriptionHistory.create({
      data: {
        accountId,
        planId: plan.id,
        planName: plan.name,
        action: 'created',
        newPlan: plan.name,
        amount: plan.basePrice,
      },
    });

    logger.info(`Subscription created: ${subscription.id} for account ${accountId}`);
    return subscription;
  }

  /**
   * Create lifetime subscription (one-time payment)
   */
  async createLifetimeSubscription(accountId: string, plan: any) {
    const customer = await this.getOrCreateCustomer(accountId);

    // Create one-time payment intent
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(parseFloat(plan.basePrice.toString()) * 100), // Convert to cents
      currency: 'usd',
      customer: customer.id as string,
      metadata: {
        accountId,
        planId: plan.id,
        planName: plan.name,
        type: 'lifetime_subscription',
      },
      description: `${plan.name} - ${plan.lifetimeDuration} Year Access`,
    });

    const expirationDate = new Date();
    expirationDate.setFullYear(expirationDate.getFullYear() + (plan.lifetimeDuration || 4));

    // Update account
    await prisma.account.update({
      where: { id: accountId },
      data: {
        subscriptionPlanId: plan.id,
        subscriptionStatus: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: expirationDate,
      },
    });

    // Log subscription
    await prisma.subscriptionHistory.create({
      data: {
        accountId,
        planId: plan.id,
        planName: plan.name,
        action: 'created',
        newPlan: plan.name,
        amount: plan.basePrice,
        metadata: { type: 'lifetime', duration: plan.lifetimeDuration },
      },
    });

    return paymentIntent;
  }

  /**
   * Calculate extra user charges
   */
  async calculateExtraUserCharges(accountId: string) {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        subscriptionPlan: true,
        accountUsers: { where: { role: { in: ['ACCOUNT_OWNER', 'ADMIN', 'SALES_REP'] } } },
      },
    });

    if (!account || !account.subscriptionPlan) {
      return { extraUsers: 0, extraCharge: 0 };
    }

    const plan = account.subscriptionPlan;
    const activeUsers = account.accountUsers.length;

    // Unlimited users
    if (plan.includedUsers === -1) {
      return { extraUsers: 0, extraCharge: 0 };
    }

    const extraUsers = Math.max(0, activeUsers - plan.includedUsers);
    const extraCharge = extraUsers * parseFloat(plan.extraUserPrice.toString());

    return { extraUsers, extraCharge };
  }

  /**
   * Update subscription with extra user charges
   */
  async updateSubscriptionUsage(accountId: string) {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: { 
        subscriptionPlan: true,
        accountUsers: true,
      },
    });

    if (!account || !account.stripeCustomerId) {
      throw new AppError('Account or Stripe customer not found', 404);
    }

    const { extraUsers, extraCharge } = await this.calculateExtraUserCharges(accountId);

    // Update account record
    await prisma.account.update({
      where: { id: accountId },
      data: {
        activeUserCount: account.accountUsers?.length || 0,
        extraUserCharge: extraCharge,
      },
    });

    // If there are extra users, log for billing
    if (extraUsers > 0 && account.subscriptionPlan?.stripePriceId) {
      const subscriptions = await this.stripe.subscriptions.list({
        customer: account.stripeCustomerId,
        status: 'active',
        limit: 1,
      });

      if (subscriptions.data.length > 0) {
        // Add metered billing for extra users (if configured)
        logger.info(`Extra users detected: ${extraUsers} for account ${accountId}, charge: $${extraCharge}`);
      }
    }

    return { extraUsers, extraCharge };
  }

  /**
   * Change subscription plan (upgrade/downgrade)
   */
  async changeSubscription(accountId: string, newPlanId: string) {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: { subscriptionPlan: true },
    });

    if (!account || !account.stripeCustomerId) {
      throw new AppError('Account not found or no Stripe customer', 404);
    }

    const newPlan = await prisma.subscriptionPlan.findUnique({
      where: { id: newPlanId },
    });

    if (!newPlan || !newPlan.isActive) {
      throw new AppError('Invalid subscription plan', 400);
    }

    // Get current subscription
    const subscriptions = await this.stripe.subscriptions.list({
      customer: account.stripeCustomerId,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      throw new AppError('No active subscription found', 404);
    }

    const subscription = subscriptions.data[0];

    // Update subscription
    const updatedSubscription = await this.stripe.subscriptions.update(subscription.id, {
      items: [
        {
          id: subscription.items.data[0].id,
          price: newPlan.stripePriceId!,
        },
      ],
      proration_behavior: 'always_invoice',
      metadata: {
        accountId,
        planId: newPlan.id,
        planName: newPlan.name,
      },
    });

    // Update account
    await prisma.account.update({
      where: { id: accountId },
      data: {
        subscriptionPlanId: newPlan.id,
        currentPeriodEnd: new Date(updatedSubscription.current_period_end * 1000),
      },
    });

    // Log history
    await prisma.subscriptionHistory.create({
      data: {
        accountId,
        planId: newPlan.id,
        planName: newPlan.name,
        action: parseFloat(newPlan.basePrice.toString()) > parseFloat(account.subscriptionPlan?.basePrice?.toString() || '0') 
          ? 'upgraded' 
          : 'downgraded',
        previousPlan: account.subscriptionPlan?.name,
        newPlan: newPlan.name,
        amount: newPlan.basePrice,
      },
    });

    logger.info(`Subscription updated for account ${accountId}: ${account.subscriptionPlan?.name} → ${newPlan.name}`);
    return updatedSubscription;
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(accountId: string, immediately = false) {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: { subscriptionPlan: true },
    });

    if (!account || !account.stripeCustomerId) {
      throw new AppError('Account not found', 404);
    }

    const subscriptions = await this.stripe.subscriptions.list({
      customer: account.stripeCustomerId,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      throw new AppError('No active subscription found', 404);
    }

    const subscription = subscriptions.data[0];

    if (immediately) {
      await this.stripe.subscriptions.cancel(subscription.id);
      
      await prisma.account.update({
        where: { id: accountId },
        data: { subscriptionStatus: 'canceled' },
      });
    } else {
      // Cancel at period end
      await this.stripe.subscriptions.update(subscription.id, {
        cancel_at_period_end: true,
      });
    }

    // Log history
    await prisma.subscriptionHistory.create({
      data: {
        accountId,
        planId: account.subscriptionPlanId,
        planName: account.subscriptionPlan?.name || 'Unknown',
        action: 'canceled',
        previousPlan: account.subscriptionPlan?.name,
      },
    });

    logger.info(`Subscription canceled for account ${accountId}`);
    return subscription;
  }

  /**
   * Handle webhook events from Stripe
   */
  async handleWebhook(event: Stripe.Event) {
    logger.info(`Stripe webhook received: ${event.type}`);

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'payment_intent.succeeded':
        await this.handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
        break;

      default:
        logger.debug(`Unhandled webhook event: ${event.type}`);
    }
  }

  private async handleSubscriptionUpdate(subscription: Stripe.Subscription) {
    const accountId = subscription.metadata.accountId;
    if (!accountId) return;

    await prisma.account.update({
      where: { id: accountId },
      data: {
        subscriptionStatus: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
    });

    logger.info(`Subscription updated for account ${accountId}: ${subscription.status}`);
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const accountId = subscription.metadata.accountId;
    if (!accountId) return;

    await prisma.account.update({
      where: { id: accountId },
      data: {
        subscriptionStatus: 'canceled',
        isActive: false,
      },
    });

    logger.info(`Subscription deleted for account ${accountId}`);
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice) {
    const accountId = invoice.metadata?.accountId;
    if (!accountId) return;

    // Create payment record
    await prisma.payment.create({
      data: {
        accountId,
        stripePaymentId: invoice.payment_intent as string,
        stripeInvoiceId: invoice.id,
        amount: invoice.amount_paid / 100, // Convert from cents
        currency: invoice.currency,
        status: 'succeeded',
        paidAt: new Date(invoice.status_transitions.paid_at! * 1000),
      },
    });

    // Create/update invoice record
    await prisma.invoice.upsert({
      where: { stripeInvoiceId: invoice.id },
      create: {
        accountId,
        stripeInvoiceId: invoice.id,
        invoiceNumber: invoice.number,
        amountDue: invoice.amount_due / 100,
        amountPaid: invoice.amount_paid / 100,
        currency: invoice.currency,
        status: invoice.status!,
        hostedUrl: invoice.hosted_invoice_url,
        pdfUrl: invoice.invoice_pdf,
        periodStart: new Date(invoice.period_start * 1000),
        periodEnd: new Date(invoice.period_end * 1000),
        paidAt: invoice.status_transitions.paid_at ? new Date(invoice.status_transitions.paid_at * 1000) : null,
      },
      update: {
        status: invoice.status!,
        amountPaid: invoice.amount_paid / 100,
        paidAt: invoice.status_transitions.paid_at ? new Date(invoice.status_transitions.paid_at * 1000) : null,
      },
    });

    logger.info(`Invoice paid for account ${accountId}: ${invoice.id}`);
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice) {
    const accountId = invoice.metadata?.accountId;
    if (!accountId) return;

    await prisma.account.update({
      where: { id: accountId },
      data: { subscriptionStatus: 'past_due' },
    });

    // Create notification
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: { accountUsers: { where: { role: 'ACCOUNT_OWNER' }, include: { user: true } } },
    });

    if (account) {
      for (const accountUser of account.accountUsers) {
        await prisma.notification.create({
          data: {
            userId: accountUser.userId,
            type: 'error',
            title: 'Payment Failed',
            message: `Your payment of $${(invoice.amount_due / 100).toFixed(2)} failed. Please update your payment method.`,
            metadata: { invoiceId: invoice.id },
          },
        });
      }
    }

    logger.warn(`Payment failed for account ${accountId}: ${invoice.id}`);
  }

  private async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
    const accountId = paymentIntent.metadata?.accountId;
    if (!accountId) return;

    await prisma.payment.create({
      data: {
        accountId,
        stripePaymentId: paymentIntent.id,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        status: 'succeeded',
        paymentMethod: paymentIntent.payment_method as string,
        description: paymentIntent.description,
        metadata: paymentIntent.metadata,
        paidAt: new Date(),
      },
    });

    logger.info(`Payment succeeded for account ${accountId}: ${paymentIntent.id}`);
  }

  /**
   * Check and handle lifetime subscription expirations
   */
  async checkLifetimeExpirations() {
    const expiredAccounts = await prisma.account.findMany({
      where: {
        subscriptionStatus: 'active',
        currentPeriodEnd: { lte: new Date() },
        subscriptionPlan: {
          billingInterval: 'lifetime',
        },
      },
      include: { subscriptionPlan: true },
    });

    for (const account of expiredAccounts) {
      const plan = account.subscriptionPlan;
      
      if (plan?.revertToPlanId) {
        // Revert to monthly plan
        await prisma.account.update({
          where: { id: account.id },
          data: {
            subscriptionPlanId: plan.revertToPlanId,
            subscriptionStatus: 'active',
          },
        });

        // Log history
        await prisma.subscriptionHistory.create({
          data: {
            accountId: account.id,
            planId: plan.revertToPlanId,
            planName: 'Pro',
            action: 'expired',
            previousPlan: plan.name,
            newPlan: 'Pro',
            metadata: { reason: 'lifetime_expired' },
          },
        });

        logger.info(`Lifetime subscription expired for account ${account.id}, reverted to monthly`);
      }
    }
  }
}

export const stripeService = new StripeService();
