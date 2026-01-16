# Dealers Face - Quick Start Guide

Complete guide to running the Dealers Face application locally and in production.

## 📋 Prerequisites

- **Node.js** 18+ with npm
- **PostgreSQL** 14+ database
- **Redis** 6+ server
- **Git** for version control

## 🚀 Local Development Setup

### 1. Clone Repository

```bash
git clone https://github.com/MangaiYashobeam/FMD.git
cd FMD
```

### 2. Install Dependencies

```bash
# Backend
npm install

# Frontend
cd client
npm install
cd ..
```

### 3. Configure Environment Variables

Create `.env` file in root directory:

```env
# Server
NODE_ENV=development
PORT=3000
API_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dealersface

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT Secrets
JWT_SECRET=;3GDrA"]2&,&!w5@3L`oxxYSWC'?RtJh<wM#YN,}O{0y95EI;st1t_u\J7+XVNC?
JWT_REFRESH_SECRET=>y{4d0YCSm~)&>e~cJ8&D^b(T9{]S.+aWH-PWS.4)o2F_qKe}\j`x<FFx'N'.Pg%
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Encryption
FB_CREDENTIALS_KEY=4d4a0e9d9f7d709dca9f426c2c1229bf566c5486cd7ca2b3b431709def5daf8b

# Stripe (Test Mode)
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Email (Development - uses Ethereal test accounts automatically)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM=noreply@dealersface.com
EMAIL_FROM_NAME=Dealers Face

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

Create `client/.env`:

```env
VITE_API_URL=http://localhost:3000/api
```

### 4. Database Setup

```bash
# Generate Prisma Client
npm run db:generate

# Run database migrations
npm run db:push

# Seed subscription plans (optional)
npx ts-node prisma/seeds/subscriptionPlans.seed.ts
```

### 5. Start Development Servers

**Terminal 1 - Backend:**
```bash
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd client
npm run dev
```

**Terminal 3 - Redis (if not running as service):**
```bash
redis-server
```

### 6. Access Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **API Health**: http://localhost:3000/health

## 🎯 Default Super Admin Setup

Create a super admin user via API or database:

```sql
-- Create super admin user
INSERT INTO users (id, email, password_hash, first_name, last_name, is_active, email_verified)
VALUES (
  gen_random_uuid(),
  'admin@dealersface.com',
  '$2b$12$your_bcrypt_hashed_password_here',
  'Admin',
  'User',
  true,
  true
);

-- Get the user ID
SELECT id FROM users WHERE email = 'admin@dealersface.com';

-- Create super admin account
INSERT INTO accounts (id, name, is_active, subscription_status)
VALUES (gen_random_uuid(), 'Dealers Face Admin', true, 'active');

-- Link user to account with SUPER_ADMIN role
INSERT INTO account_users (id, user_id, account_id, role)
VALUES (
  gen_random_uuid(),
  'user_id_from_above',
  'account_id_from_above',
  'SUPER_ADMIN'
);
```

Or use bcrypt to hash a password:

```javascript
const bcrypt = require('bcrypt');
const password = 'YourSecurePassword123!';
bcrypt.hash(password, 12).then(hash => console.log(hash));
```

## 📱 Chrome Extension Setup

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `chrome-extension` folder from the project
5. Extension is now installed and ready to use

## 🔧 Development Commands

### Backend

```bash
npm run dev          # Start development server with hot reload
npm run build        # Build TypeScript to JavaScript
npm run start        # Start production server
npm run db:generate  # Generate Prisma Client
npm run db:push      # Push schema changes to database
npm run db:studio    # Open Prisma Studio (database GUI)
```

### Frontend

```bash
npm run dev      # Start Vite dev server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

## 🚢 Production Deployment (Railway)

### 1. Prepare Repository

Ensure all code is committed and pushed to GitHub:

```bash
git add -A
git commit -m "Ready for production deployment"
git push origin main
```

### 2. Configure Railway Project

1. Go to [Railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select `MangaiYashobeam/FMD` repository
4. Railway will auto-detect Node.js project

### 3. Add PostgreSQL Service

1. Click "New" → "Database" → "PostgreSQL"
2. Railway creates database and sets `DATABASE_URL` automatically

### 4. Add Redis Service

1. Click "New" → "Database" → "Redis"
2. Railway sets `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` automatically

### 5. Configure Environment Variables

In Railway dashboard, add these variables:

```env
NODE_ENV=production
PORT=3000

# JWT Secrets (copy from local .env)
JWT_SECRET=;3GDrA"]2&,&!w5@3L`oxxYSWC'?RtJh<wM#YN,}O{0y95EI;st1t_u\J7+XVNC?
JWT_REFRESH_SECRET=>y{4d0YCSm~)&>e~cJ8&D^b(T9{]S.+aWH-PWS.4)o2F_qKe}\j`x<FFx'N'.Pg%

# Encryption (copy from local .env)
FB_CREDENTIALS_KEY=4d4a0e9d9f7d709dca9f426c2c1229bf566c5486cd7ca2b3b431709def5daf8b

# Stripe (Production Keys)
STRIPE_SECRET_KEY=sk_live_your_live_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Email (Production SMTP)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your_sendgrid_api_key
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=Dealers Face

# CORS (add your frontend domain)
ALLOWED_ORIGINS=https://your-frontend-domain.com
API_URL=https://your-api-domain.railway.app
```

### 6. Deploy Backend

Railway automatically deploys when you push to GitHub.

To deploy manually:
```bash
git push origin main
```

Railway will:
1. Install dependencies
2. Build TypeScript
3. Run Prisma migrations
4. Start server

### 7. Deploy Frontend

**Option A: Deploy to Vercel**

1. Go to [Vercel](https://vercel.com)
2. Import `client` folder as new project
3. Set environment variable: `VITE_API_URL=https://your-api.railway.app/api`
4. Deploy

**Option B: Deploy to Railway**

1. Create separate Railway service for frontend
2. Set root directory to `client`
3. Build command: `npm run build`
4. Start command: `npx serve -s dist -l 3000`

### 8. Configure Stripe Webhooks

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/webhooks)
2. Add endpoint: `https://your-api.railway.app/api/subscriptions/webhook`
3. Select events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `payment_intent.succeeded`
4. Copy webhook signing secret to Railway env var `STRIPE_WEBHOOK_SECRET`

### 9. Run Database Migrations

SSH into Railway container and run:

```bash
npx prisma migrate deploy
npx prisma db seed  # Optional: seed subscription plans
```

## 🔍 Monitoring & Troubleshooting

### Check Logs

**Railway:**
- Click on service → "Logs" tab
- Filter by error/info/debug

**Local:**
```bash
tail -f logs/app.log
```

### Database Issues

```bash
# Check connection
npx prisma db pull

# Reset database (DANGER: deletes all data)
npx prisma migrate reset

# View database in GUI
npx prisma studio
```

### Email Testing

Check logs for Ethereal preview URLs in development:
```
📧 Preview URL: https://ethereal.email/message/abc123
```

### Redis Connection

```bash
# Test Redis locally
redis-cli ping
# Should return: PONG

# Check connection
redis-cli
> KEYS *
```

## 📊 System Monitoring

### Health Check Endpoints

- `GET /health` - Server health
- `GET /api/admin/stats` - System statistics (requires SUPER_ADMIN)

### Queue Monitoring

```javascript
// Check queue status
const { emailQueue } = require('./src/queues/email.queue');
const counts = await emailQueue.getJobCounts();
console.log(counts); // { waiting, active, completed, failed }
```

## 🔐 Security Checklist

- [ ] Change all default secrets in production
- [ ] Enable HTTPS (Railway provides automatically)
- [ ] Configure CORS to only allow your domains
- [ ] Set up Stripe in live mode
- [ ] Configure production SMTP provider
- [ ] Enable 2FA for admin accounts
- [ ] Set up database backups
- [ ] Monitor rate limiting logs
- [ ] Review audit logs regularly

## 📚 Additional Resources

- [API Documentation](./docs/API_DOCUMENTATION.md)
- [Email System](./docs/EMAIL_SYSTEM.md)
- [Facebook Architecture](./docs/FACEBOOK_POSTING_ARCHITECTURE.md)
- [Deployment Guide](./docs/DEPLOYMENT_GUIDE.md)
- [RBAC System](./docs/RBAC_SYSTEM.md)

## 🆘 Common Issues

### "Module not found" errors
```bash
npm install
cd client && npm install
```

### Database connection errors
Check `DATABASE_URL` format:
```
postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public
```

### Prisma Client errors
```bash
npm run db:generate
```

### Build fails
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

## 📞 Support

For issues or questions:
- Create GitHub Issue: https://github.com/MangaiYashobeam/FMD/issues
- Check existing documentation in `/docs` folder
