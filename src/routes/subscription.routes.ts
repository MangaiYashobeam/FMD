import { Router } from 'express';
import { authenticate } from '@/middleware/auth';
import { SubscriptionController } from '@/controllers/subscription.controller';
import { asyncHandler } from '@/utils/asyncHandler';

const router = Router();
const controller = new SubscriptionController();

/**
 * @route   GET /api/subscriptions/plans
 * @desc    Get all available subscription plans
 * @access  Public
 */
router.get('/plans', asyncHandler(controller.getPlans.bind(controller)));

/**
 * @route   POST /api/subscriptions/webhook
 * @desc    Handle Stripe webhooks
 * @access  Public (Stripe only)
 */
router.post('/webhook', asyncHandler(controller.handleWebhook.bind(controller)));

// Protected routes
router.use(authenticate);

/**
 * @route   GET /api/subscriptions/:accountId
 * @desc    Get current subscription for account
 * @access  Private
 */
router.get('/:accountId', asyncHandler(controller.getCurrentSubscription.bind(controller)));

/**
 * @route   POST /api/subscriptions/:accountId/subscribe
 * @desc    Subscribe to a plan
 * @access  Private
 */
router.post('/:accountId/subscribe', asyncHandler(controller.subscribe.bind(controller)));

/**
 * @route   PUT /api/subscriptions/:accountId/change-plan
 * @desc    Change subscription plan
 * @access  Private
 */
router.put('/:accountId/change-plan', asyncHandler(controller.changePlan.bind(controller)));

/**
 * @route   POST /api/subscriptions/:accountId/cancel
 * @desc    Cancel subscription
 * @access  Private
 */
router.post('/:accountId/cancel', asyncHandler(controller.cancel.bind(controller)));

/**
 * @route   GET /api/subscriptions/:accountId/payments
 * @desc    Get payment history
 * @access  Private
 */
router.get('/:accountId/payments', asyncHandler(controller.getPayments.bind(controller)));

/**
 * @route   GET /api/subscriptions/:accountId/invoices
 * @desc    Get invoice history
 * @access  Private
 */
router.get('/:accountId/invoices', asyncHandler(controller.getInvoices.bind(controller)));

/**
 * @route   GET /api/subscriptions/:accountId/history
 * @desc    Get subscription history
 * @access  Private
 */
router.get('/:accountId/history', asyncHandler(controller.getHistory.bind(controller)));

/**
 * @route   POST /api/subscriptions/:accountId/checkout
 * @desc    Create Stripe checkout session
 * @access  Private
 */
router.post('/:accountId/checkout', asyncHandler(controller.createCheckoutSession.bind(controller)));

/**
 * @route   POST /api/subscriptions/:accountId/portal
 * @desc    Create billing portal session
 * @access  Private
 */
router.post('/:accountId/portal', asyncHandler(controller.createPortalSession.bind(controller)));

export default router;
