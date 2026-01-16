# Production Deployment Guide

## Railway Environment Variables Configuration

This document lists all required environment variables for deploying Dealers Face to Railway.

### 📋 Required Environment Variables

#### Database
```bash
DATABASE_URL="postgresql://postgres:password@host:port/database"
```
*Note: Railway automatically provides this when you provision a PostgreSQL database*

#### Authentication & Security
```bash
# JWT Secrets (PRODUCTION - DO NOT CHANGE)
JWT_SECRET=";3GDrA"]2&,&!w5@3L`oxxYSWC'?RtJh<wM#YN,}O{0y95EI;st1t_u\J7+XVNC?"
JWT_REFRESH_SECRET=">y{4d0YCSm~)&>e~cJ8&D^b(T9{]S.+aWH-PWS.4)o2F_qKe}\j`x<FFx'N'.Pg%"

# Facebook Credentials Encryption
FB_CREDENTIALS_KEY="4d4a0e9d9f7d709dca9f426c2c1229bf566c5486cd7ca2b3b431709def5daf8b"
```

#### Application
```bash
NODE_ENV="production"
PORT="3000"
```

#### CORS & Security
```bash
# Add your Railway domain here
ALLOWED_ORIGINS="https://your-app.up.railway.app,https://your-custom-domain.com"

# Rate limiting
RATE_LIMIT_WINDOW_MS="900000"
RATE_LIMIT_MAX_REQUESTS="100"
```

#### Redis (for queues)
```bash
REDIS_URL="redis://default:password@host:port"
```
*Note: Provision a Redis instance in Railway and it will provide this*

#### Email Configuration
Choose ONE option:

**Option 1: Ethereal (Development/Testing)**
```bash
EMAIL_FROM="noreply@dealersface.com"
# No other config needed - Ethereal auto-configures
```

**Option 2: SendGrid (Recommended for Production)**
```bash
EMAIL_FROM="noreply@dealersface.com"
SMTP_HOST="smtp.sendgrid.net"
SMTP_PORT="587"
SMTP_USER="apikey"
SMTP_PASS="YOUR_SENDGRID_API_KEY"
```

**Option 3: AWS SES**
```bash
EMAIL_FROM="noreply@dealersface.com"
SMTP_HOST="email-smtp.us-east-1.amazonaws.com"
SMTP_PORT="587"
SMTP_USER="YOUR_SES_ACCESS_KEY"
SMTP_PASS="YOUR_SES_SECRET_KEY"
```

**Option 4: Gmail**
```bash
EMAIL_FROM="your-email@gmail.com"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
```

#### Stripe Payment Integration
```bash
# Get these from https://dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY="sk_live_YOUR_LIVE_SECRET_KEY"
STRIPE_PUBLISHABLE_KEY="pk_live_YOUR_LIVE_PUBLISHABLE_KEY"

# Webhook endpoint secret (from Stripe Dashboard -> Webhooks)
STRIPE_WEBHOOK_SECRET="whsec_YOUR_WEBHOOK_SECRET"
```

#### Facebook Graph API
```bash
# Create app at https://developers.facebook.com/
FACEBOOK_APP_ID="your_app_id"
FACEBOOK_APP_SECRET="your_app_secret"
FACEBOOK_REDIRECT_URI="https://your-app.up.railway.app/api/auth/facebook/callback"
```

---

## 🚀 Deployment Steps

### 1. Create Railway Project
```bash
# From project root
railway login
railway init
```

### 2. Provision PostgreSQL
1. Go to Railway dashboard
2. Click "New" → "Database" → "PostgreSQL"
3. Railway will auto-inject `DATABASE_URL`

### 3. Provision Redis
1. Click "New" → "Database" → "Redis"
2. Railway will auto-inject `REDIS_URL`

### 4. Add Environment Variables
Copy all variables from this document into Railway:
```bash
# CLI method
railway variables set JWT_SECRET=";3GDrA"]2&,&!w5@3L`oxxYSWC'?RtJh<wM#YN,}O{0y95EI;st1t_u\J7+XVNC?"
railway variables set JWT_REFRESH_SECRET=">y{4d0YCSm~)&>e~cJ8&D^b(T9{]S.+aWH-PWS.4)o2F_qKe}\j`x<FFx'N'.Pg%"
# ... continue for all variables

# OR use Railway Dashboard:
# Settings → Variables → Add all variables
```

### 5. Run Database Migrations
```bash
railway run npm run migrate
```

### 6. Seed Subscription Plans
```bash
railway run npm run seed
```

### 7. Deploy Application
```bash
railway up
```

---

## 🔐 Stripe Setup

### Create Products & Prices

1. **Go to Stripe Dashboard** → Products
2. **Create 4 products:**

**Starter Plan**
- Name: Starter
- Price: $49/month
- Metadata: `tier=starter`, `maxUsers=5`, `maxVehicles=50`

**Professional Plan**
- Name: Professional
- Price: $99/month
- Metadata: `tier=professional`, `maxUsers=15`, `maxVehicles=200`

**Enterprise Plan**
- Name: Enterprise
- Price: $199/month
- Metadata: `tier=enterprise`, `maxUsers=unlimited`, `maxVehicles=unlimited`

**Lifetime Plan**
- Name: Lifetime
- Price: $999/one-time
- Metadata: `tier=lifetime`, `maxUsers=unlimited`, `maxVehicles=unlimited`

3. **Copy Price IDs** from each product
4. **Update `src/services/stripe.service.ts`** with the price IDs:
```typescript
private readonly PLANS = {
  starter: 'price_XXXXXXXXXXXXX',
  professional: 'price_XXXXXXXXXXXXX',
  enterprise: 'price_XXXXXXXXXXXXX',
  lifetime: 'price_XXXXXXXXXXXXX',
};
```

### Configure Webhook
1. Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-app.up.railway.app/api/subscriptions/webhook`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
4. Copy webhook secret to `STRIPE_WEBHOOK_SECRET` environment variable

---

## 📧 Email Provider Setup

### SendGrid (Recommended)
1. Sign up at https://sendgrid.com
2. Create API key: Settings → API Keys
3. Verify sender identity: Settings → Sender Authentication
4. Add to environment:
```bash
SMTP_HOST="smtp.sendgrid.net"
SMTP_PORT="587"
SMTP_USER="apikey"
SMTP_PASS="YOUR_API_KEY"
```

### AWS SES
1. Go to AWS SES Console
2. Verify domain or email
3. Create SMTP credentials: SMTP Settings → Create SMTP Credentials
4. Add to environment variables

---

## 🌐 Custom Domain Setup

1. **Railway Dashboard** → Settings → Domains
2. **Add custom domain** (e.g., app.dealersface.com)
3. **Update DNS** with Railway's CNAME:
   ```
   CNAME: app → your-app.up.railway.app
   ```
4. **Update CORS** environment variable:
   ```bash
   ALLOWED_ORIGINS="https://app.dealersface.com"
   ```

---

## ✅ Post-Deployment Checklist

- [ ] PostgreSQL database provisioned
- [ ] Redis instance provisioned
- [ ] All environment variables set
- [ ] Database migrations ran successfully
- [ ] Subscription plans seeded
- [ ] Stripe webhook configured
- [ ] Email sending tested
- [ ] Custom domain configured (if applicable)
- [ ] HTTPS working
- [ ] Create first super admin user:
  ```bash
  railway run npm run create-admin
  ```

---

## 🔍 Monitoring & Logs

### View Logs
```bash
railway logs
```

### Monitor Services
- Railway Dashboard → Deployments → View metrics
- Check CPU, Memory, Network usage

### Database Queries
```bash
railway connect
psql $DATABASE_URL
```

---

## 🐛 Troubleshooting

### Database Connection Issues
```bash
# Check DATABASE_URL is set
railway variables

# Test connection
railway run npm run migrate
```

### Email Not Sending
1. Check SMTP credentials
2. View email queue:
   ```bash
   railway run npm run queue:check
   ```
3. Check email logs in database

### Stripe Webhook Failures
1. Stripe Dashboard → Developers → Webhooks → View logs
2. Ensure webhook secret matches `STRIPE_WEBHOOK_SECRET`
3. Check Railway logs for errors

---

## 📊 Database Schema

After deployment, your database will have:
- ✅ 20 tables (User, Account, Vehicle, FacebookPost, etc.)
- ✅ All indexes and relations
- ✅ 4 subscription plans pre-seeded

---

## 🔄 Continuous Deployment

Railway auto-deploys from GitHub:
1. Push to `main` branch
2. Railway detects changes
3. Runs build & deploy automatically

### Manual Deploy
```bash
railway up
```

---

## 📝 Notes

- **JWT Secrets**: The provided secrets are production-grade (64 characters)
- **FB Encryption Key**: AES-256 key for encrypting Facebook credentials
- **Stripe**: Use test keys for staging, live keys for production
- **CORS**: Always update `ALLOWED_ORIGINS` with your production domain
- **Rate Limiting**: Adjust based on your traffic (default: 100 req/15min)

---

## 🆘 Support

If you encounter issues:
1. Check Railway logs: `railway logs`
2. Review environment variables
3. Ensure all secrets are set correctly
4. Check database connectivity

---

**Last Updated:** January 2025
**Version:** 1.0.0
