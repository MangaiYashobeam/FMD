# Stripe Payment Integration Setup Guide

This guide walks you through setting up Stripe payment integration for FaceMyDealer subscriptions.

## Prerequisites

- Stripe account (create at [stripe.com](https://stripe.com))
- FaceMyDealer production environment deployed
- SSL/HTTPS configured (required for Stripe)

## Step 1: Create a Stripe Account

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Sign up or log in
3. Complete business verification (required for live payments)

## Step 2: Get API Keys

### Test Mode Keys (Development)

1. Go to **Developers** → **API Keys**
2. Copy your test keys:
   - **Publishable key**: `pk_test_...`
   - **Secret key**: `sk_test_...`

### Live Mode Keys (Production)

1. Toggle to **Live Mode** (top-right switch)
2. Copy your live keys:
   - **Publishable key**: `pk_live_...`
   - **Secret key**: `sk_live_...`

> ⚠️ **Security**: Never expose secret keys in client-side code

## Step 3: Configure Products and Prices

### Create Subscription Products

1. Go to **Products** → **Add Product**
2. Create the following products:

#### Basic Plan

| Field | Value |
|-------|-------|
| Name | FaceMyDealer Basic |
| Description | Essential features for small dealerships |
| Pricing | $49/month (recurring) |
| Metadata | `tier: basic, vehicles: 50` |

#### Professional Plan

| Field | Value |
|-------|-------|
| Name | FaceMyDealer Professional |
| Description | Advanced features for growing dealerships |
| Pricing | $99/month (recurring) |
| Metadata | `tier: professional, vehicles: 200` |

#### Enterprise Plan

| Field | Value |
|-------|-------|
| Name | FaceMyDealer Enterprise |
| Description | Full-featured for large operations |
| Pricing | $199/month (recurring) |
| Metadata | `tier: enterprise, vehicles: unlimited` |

### Copy Price IDs

After creating products, copy each price ID:
- Basic: `price_xxxxxxxxxxxxx`
- Professional: `price_xxxxxxxxxxxxx`
- Enterprise: `price_xxxxxxxxxxxxx`

## Step 4: Set Up Webhooks

Webhooks notify your server of payment events.

### Create Webhook Endpoint

1. Go to **Developers** → **Webhooks**
2. Click **Add Endpoint**
3. Configure:

```
Endpoint URL: https://fmd-production.up.railway.app/api/webhooks/stripe
Description: FaceMyDealer subscription events
Events to send:
  - checkout.session.completed
  - customer.subscription.created
  - customer.subscription.updated
  - customer.subscription.deleted
  - invoice.paid
  - invoice.payment_failed
  - payment_intent.succeeded
  - payment_intent.payment_failed
```

4. Click **Add Endpoint**
5. Copy the **Signing Secret**: `whsec_...`

## Step 5: Configure Environment Variables

Add these to your Railway environment:

```env
# Stripe API Keys
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx

# Stripe API Version
STRIPE_API_VERSION=2025-02-24.acacia

# Price IDs
STRIPE_PRICE_BASIC=price_xxxxxxxxxxxxx
STRIPE_PRICE_PROFESSIONAL=price_xxxxxxxxxxxxx
STRIPE_PRICE_ENTERPRISE=price_xxxxxxxxxxxxx
```

### Frontend Environment (web/.env.production)

```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxx
```

## Step 6: Configure Customer Portal

Allow customers to manage their subscriptions.

1. Go to **Settings** → **Billing** → **Customer Portal**
2. Enable the following features:

```
✓ Update payment methods
✓ View invoice history
✓ Cancel subscriptions
✓ Update subscription (switch plans)
```

3. Configure portal settings:
   - **Portal link**: Enable
   - **Business info**: Add your logo and business name
   - **Proration behavior**: Create prorations

4. Save settings and copy the portal link

## Step 7: Test the Integration

### Test Card Numbers

| Scenario | Card Number |
|----------|-------------|
| Successful payment | `4242 4242 4242 4242` |
| Requires authentication | `4000 0025 0000 3155` |
| Declined | `4000 0000 0000 0002` |
| Insufficient funds | `4000 0000 0000 9995` |

### Test a Subscription

1. Navigate to Settings → Billing
2. Click **Upgrade Plan**
3. Select a plan
4. Use a test card number
5. Verify subscription is active

### Test Webhook Events

1. In Stripe Dashboard, go to **Developers** → **Webhooks**
2. Click your endpoint
3. Click **Send test webhook**
4. Select an event type and send
5. Verify your server handles it correctly

## Step 8: Go Live

### Pre-Launch Checklist

- [ ] Business verification complete
- [ ] Live API keys configured
- [ ] Webhook endpoint using live secret
- [ ] All products created in live mode
- [ ] Test transactions successful
- [ ] Invoice emails configured
- [ ] Tax settings configured (if applicable)

### Switch to Live Mode

1. Update environment variables with live keys
2. Verify webhook endpoint is receiving live events
3. Process a real transaction to confirm

## Subscription Management

### How Subscriptions Work

```
User selects plan
    ↓
Stripe Checkout Session created
    ↓
User completes payment
    ↓
Webhook: checkout.session.completed
    ↓
Account updated to paid tier
    ↓
Monthly: invoice.paid or invoice.payment_failed
```

### Handling Failed Payments

FaceMyDealer automatically:
1. Sends reminder emails
2. Retries payment (3 attempts over 7 days)
3. Downgrades to free tier if all attempts fail

### Cancellations

- **Immediate**: Access ends immediately
- **End of period**: Access continues until billing period ends

## Troubleshooting

### Common Issues

**Error: Invalid API Key**
- Verify you're using the correct key for the environment
- Check for whitespace in the key

**Webhook Signature Invalid**
- Ensure webhook secret matches endpoint
- Check server clock is synchronized

**Payment Declined**
- Review decline code in Stripe Dashboard
- Common causes: insufficient funds, card expired

**Subscription Not Created**
- Verify webhook is being received
- Check server logs for processing errors

### Debug Logging

Enable detailed Stripe logging:
```env
STRIPE_DEBUG=true
LOG_LEVEL=debug
```

### View Webhook Logs

1. Go to **Developers** → **Webhooks**
2. Click your endpoint
3. View **Webhook attempts** for delivery status

## Security Best Practices

1. **Verify webhook signatures** before processing
2. **Use HTTPS** for all endpoints
3. **Never log** full card numbers
4. **Implement idempotency** for webhook processing
5. **PCI compliance**: Use Stripe Elements, never handle raw card data

## Tax Configuration (Optional)

### Enable Stripe Tax

1. Go to **Settings** → **Tax**
2. Enable **Stripe Tax**
3. Configure your business address
4. Set tax registration for your jurisdiction

### Tax-Inclusive Pricing

To include tax in displayed prices:
```env
STRIPE_TAX_INCLUSIVE=true
```

## Reporting and Analytics

### Stripe Dashboard Reports

- **Revenue**: Total volume over time
- **Subscriptions**: MRR, churn rate
- **Customers**: Growth, retention
- **Disputes**: Chargebacks to monitor

### Export Data

1. Go to **Reports** → **Exports**
2. Select report type and date range
3. Download as CSV

## Support Resources

- [Stripe Documentation](https://stripe.com/docs)
- [Stripe API Reference](https://stripe.com/docs/api)
- [Stripe CLI](https://stripe.com/docs/stripe-cli) (for local testing)
- [Stripe Support](https://support.stripe.com/)

---

## Quick Setup Checklist

- [ ] Create Stripe account
- [ ] Get API keys (test and live)
- [ ] Create subscription products and prices
- [ ] Set up webhook endpoint
- [ ] Configure environment variables
- [ ] Enable customer portal
- [ ] Test with test cards
- [ ] Complete business verification
- [ ] Switch to live mode
