import { Response } from 'express';
import { AuthRequest } from '@/middleware/auth';
import prisma from '@/config/database';
import { AppError } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import { stripeService } from '@/services/stripe.service';
import Stripe from 'stripe';

export class SubscriptionController {
  /**
   * Get all available subscription plans
   */
  async getPlans(_req: AuthRequest, res: Response): Promise<void> {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });

    res.json(plans);
  }

  /**
   * Get current subscription details for account
   */
  async getCurrentSubscription(req: AuthRequest, res: Response): Promise<void> {
    const accountId = req.params.accountId as string;

    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        subscriptionPlan: true,
        accountUsers: {
          where: { role: { in: ['ACCOUNT_OWNER', 'ADMIN', 'SALES_REP'] } },
          include: { user: true },
        },
      },
    });

    if (!account) {
      throw new AppError('Account not found', 404);
    }

    // Calculate extra user charges
    const { extraUsers, extraCharge } = await stripeService.calculateExtraUserCharges(accountId);

    res.json({
      account: {
        id: account.id,
        name: account.name,
        subscriptionStatus: account.subscriptionStatus,
        currentPeriodStart: account.currentPeriodStart,
        currentPeriodEnd: account.currentPeriodEnd,
        trialEndsAt: account.trialEndsAt,
        activeUserCount: account.accountUsers.length,
      },
      plan: account.subscriptionPlan,
      usage: {
        activeUsers: account.accountUsers.length,
        includedUsers: account.subscriptionPlan?.includedUsers || 0,
        extraUsers,
        extraCharge,
        totalMonthlyCharge: account.subscriptionPlan
          ? parseFloat(account.subscriptionPlan.basePrice.toString()) + extraCharge
          : 0,
      },
    });
  }

  /**
   * Subscribe to a plan
   */
  async subscribe(req: AuthRequest, res: Response): Promise<void> {
    const accountId = req.params.accountId as string;
    const { planId } = req.body;

    if (!planId) {
      throw new AppError('Plan ID is required', 400);
    }

    try {
      const subscription = await stripeService.createSubscription(accountId, planId);
      
      res.json({
        success: true,
        subscription,
        message: 'Subscription created successfully',
      });
    } catch (error: any) {
      logger.error('Error creating subscription:', error);
      throw new AppError(error.message || 'Failed to create subscription', 500);
    }
  }

  /**
   * Change subscription plan
   */
  async changePlan(req: AuthRequest, res: Response): Promise<void> {
    const accountId = req.params.accountId as string;
    const { planId } = req.body;

    if (!planId) {
      throw new AppError('Plan ID is required', 400);
    }

    try {
      const subscription = await stripeService.changeSubscription(accountId, planId);
      
      res.json({
        success: true,
        subscription,
        message: 'Subscription plan updated successfully',
      });
    } catch (error: any) {
      logger.error('Error changing subscription:', error);
      throw new AppError(error.message || 'Failed to change subscription', 500);
    }
  }

  /**
   * Cancel subscription
   */
  async cancel(req: AuthRequest, res: Response): Promise<void> {
    const accountId = req.params.accountId as string;
    const { immediately = false } = req.body;

    try {
      const subscription = await stripeService.cancelSubscription(accountId, immediately);
      
      res.json({
        success: true,
        subscription,
        message: immediately 
          ? 'Subscription canceled immediately' 
          : 'Subscription will be canceled at the end of the billing period',
      });
    } catch (error: any) {
      logger.error('Error canceling subscription:', error);
      throw new AppError(error.message || 'Failed to cancel subscription', 500);
    }
  }

  /**
   * Get payment history
   */
  async getPayments(req: AuthRequest, res: Response): Promise<void> {
    const accountId = req.params.accountId as string;
    const { limit = 20, offset = 0 } = req.query;

    const payments = await prisma.payment.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    const total = await prisma.payment.count({
      where: { accountId },
    });

    res.json({
      data: payments,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    });
  }

  /**
   * Get invoice history
   */
  async getInvoices(req: AuthRequest, res: Response): Promise<void> {
    const accountId = req.params.accountId as string;
    const { limit = 20, offset = 0 } = req.query;

    const invoices = await prisma.invoice.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    const total = await prisma.invoice.count({
      where: { accountId },
    });

    res.json({
      data: invoices,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    });
  }

  /**
   * Get subscription history
   */
  async getHistory(req: AuthRequest, res: Response): Promise<void> {
    const accountId = req.params.accountId as string;

    const history = await prisma.subscriptionHistory.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json(history);
  }

  /**
   * Create Stripe checkout session
   */
  async createCheckoutSession(req: AuthRequest, res: Response): Promise<void> {
    const accountId = req.params.accountId as string;
    const { planId, successUrl, cancelUrl } = req.body;

    if (!planId || !successUrl || !cancelUrl) {
      throw new AppError('Plan ID, success URL, and cancel URL are required', 400);
    }

    const customer = await stripeService.getOrCreateCustomer(accountId);
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan || !plan.isActive) {
      throw new AppError('Invalid subscription plan', 400);
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-02-24.acacia',
    });

    // Handle lifetime plans (one-time payment)
    if (plan.billingInterval === 'lifetime') {
      const session = await stripe.checkout.sessions.create({
        customer: customer.id as string,
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: plan.name,
                description: `${plan.lifetimeDuration} Year Unlimited Access`,
              },
              unit_amount: Math.round(parseFloat(plan.basePrice.toString()) * 100),
            },
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          accountId,
          planId: plan.id,
          type: 'lifetime',
        },
      });

      res.json({ sessionId: session.id, url: session.url });
      return;
    }

    // Monthly subscription checkout
    const session = await stripe.checkout.sessions.create({
      customer: customer.id as string,
      mode: 'subscription',
      line_items: [
        {
          price: plan.stripePriceId!,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          accountId,
          planId: plan.id,
        },
      },
    });

    res.json({ sessionId: session.id, url: session.url });
  }

  /**
   * Create billing portal session
   */
  async createPortalSession(req: AuthRequest, res: Response): Promise<void> {
    const accountId = req.params.accountId as string;
    const { returnUrl } = req.body;

    if (!returnUrl) {
      throw new AppError('Return URL is required', 400);
    }

    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account || !account.stripeCustomerId) {
      throw new AppError('Account not found or no Stripe customer', 404);
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-02-24.acacia',
    });

    const session = await stripe.billingPortal.sessions.create({
      customer: account.stripeCustomerId,
      return_url: returnUrl,
    });

    res.json({ url: session.url });
  }

  /**
   * Handle Stripe webhooks
   */
  async handleWebhook(req: AuthRequest, res: Response): Promise<void> {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      throw new AppError('Missing signature or webhook secret', 400);
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-02-24.acacia',
    });

    try {
      const event = stripe.webhooks.constructEvent(
        req.body,
        sig as string,
        webhookSecret
      );

      await stripeService.handleWebhook(event);

      res.json({ received: true });
    } catch (error: any) {
      logger.error('Webhook error:', error);
      throw new AppError(`Webhook Error: ${error.message}`, 400);
    }
  }
}
