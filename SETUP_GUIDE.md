# 🚀 Dealers Face - Complete Setup Guide

This guide will walk you through setting up the entire Dealers Face platform from scratch.

---

## 📋 Prerequisites Checklist

Before starting, ensure you have:

- [ ] Node.js >= 18.0.0 installed ([Download](https://nodejs.org))
- [ ] PostgreSQL >= 14.0 installed (or Railway account)
- [ ] Redis >= 6.0 installed (or Railway account)
- [ ] Git installed
- [ ] Text editor (VS Code recommended)
- [ ] Chrome browser (for extension)

---

## 🗂️ Part 1: Local Development Setup

### Step 1: Clone and Install

```bash
# Clone the repository
git clone https://github.com/yourusername/dealersface.git
cd dealersface

# Install dependencies
npm install

# Verify installation
npm run --version
```

### Step 2: Database Setup (PostgreSQL)

**Option A: Local PostgreSQL (Windows)**

```powershell
# Install PostgreSQL using Chocolatey
choco install postgresql

# Or download installer from postgresql.org

# Start PostgreSQL service
Start-Service postgresql-x64-14

# Create database using psql
psql -U postgres
CREATE DATABASE dealersface;
CREATE USER dealersface_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE dealersface TO dealersface_user;
\q
```

**Option B: Railway (Recommended)**

1. Go to [railway.app](https://railway.app)
2. Sign up / Log in
3. Click "New Project"
4. Click "Provision PostgreSQL"
5. Go to PostgreSQL service → Variables tab
6. Copy `DATABASE_URL`

### Step 3: Redis Setup

**Option A: Local Redis (Windows)**

```powershell
# Install Redis using Chocolatey
choco install redis-64

# Or download from github.com/microsoftarchive/redis

# Start Redis
redis-server
```

**Option B: Railway**

1. In your Railway project
2. Click "New" → "Database" → "Add Redis"
3. Copy connection details from Variables tab

### Step 4: Environment Configuration

```bash
# Copy example environment file
cp .env.example .env

# Open .env in your editor
code .env
```

**Edit `.env` with your values:**

```env
# Database (from Railway or local)
DATABASE_URL=postgresql://user:password@localhost:5432/dealersface

# JWT Secrets (generate random strings)
JWT_SECRET=generate-a-random-64-character-string-here
JWT_REFRESH_SECRET=generate-another-random-64-character-string

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Encryption Key (32 characters)
ENCRYPTION_KEY=generate-32-character-key-here

# Facebook (create app at developers.facebook.com)
FACEBOOK_APP_ID=your-app-id
FACEBOOK_APP_SECRET=your-app-secret
FACEBOOK_REDIRECT_URI=http://localhost:3000/api/auth/facebook/callback

# OpenAI (optional, for AI descriptions)
OPENAI_API_KEY=sk-your-openai-key
```

**Generate random secrets:**

```powershell
# In PowerShell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | % {[char]$_})
```

### Step 5: Database Migration

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Verify with Prisma Studio
npm run db:studio
```

Prisma Studio will open at `http://localhost:5555`

### Step 6: Start Development Server

```bash
# Start backend server
npm run dev
```

Server will start at `http://localhost:3000`

**Test it:**

```bash
# Test health endpoint
curl http://localhost:3000/health
```

---

## 🌐 Part 2: Facebook App Setup

### Create Facebook App

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Click "My Apps" → "Create App"
3. Choose "Business" type
4. Fill in details:
   - App Name: "Dealers Face - [Your Name]"
   - Contact Email: your email
   
### Configure OAuth

1. Go to App → Settings → Basic
2. Copy App ID and App Secret to your `.env`
3. Add Platform → Website
   - Site URL: `http://localhost:3000`
4. Go to Facebook Login → Settings
5. Add Valid OAuth Redirect URIs:
   ```
   http://localhost:3000/api/auth/facebook/callback
   https://your-domain.com/api/auth/facebook/callback
   ```

### Request Permissions

1. Go to App Review → Permissions and Features
2. Request these permissions:
   - `pages_manage_posts` (to post on marketplace)
   - `pages_read_engagement`
   - `public_profile`
   - `email`

---

## 🧪 Part 3: Testing

### Test API Endpoints

```bash
# Register a new user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!",
    "firstName": "John",
    "lastName": "Doe",
    "accountName": "Test Dealership"
  }'

# Save the accessToken from response

# Test authenticated endpoint
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Test CSV Import

1. Place a test CSV file in `temp/test-inventory.csv`
2. Use the CSV format from `inventory2.csv` example
3. Test parsing:

```typescript
// Create test file: src/test-csv.ts
import { parseCSVFile } from './services/csvParser.service';

async function test() {
  const vehicles = await parseCSVFile('temp/test-inventory.csv');
  console.log(`Parsed ${vehicles.length} vehicles`);
  console.log(vehicles[0]);
}

test();
```

```bash
npx tsx src/test-csv.ts
```

---

## 🔌 Part 4: Chrome Extension Setup

### Build Extension

```bash
cd chrome-extension
npm install
npm run build
```

### Load in Chrome

1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select `chrome-extension/build` folder

### Test Extension

1. Click extension icon in toolbar
2. Click "Login"
3. Enter your credentials from earlier
4. Should see dashboard/inventory

---

## 📊 Part 5: Frontend Dashboard Setup

```bash
cd frontend
npm install
npm run dev
```

Dashboard will be at `http://localhost:5173`

---

## 🚀 Part 6: Production Deployment (Railway)

### Install Railway CLI

```powershell
npm install -g @railway/cli
```

### Login to Railway

```bash
railway login
```

### Initialize Project

```bash
# In project root
railway init
```

### Add Services

**In Railway Dashboard:**

1. Add PostgreSQL:
   - Click "New" → "Database" → "Add PostgreSQL"
   
2. Add Redis:
   - Click "New" → "Database" → "Add Redis"

3. Add Web Service:
   - Click "New" → "Empty Service"
   - Name it "api"

### Configure Deployment

Create `railway.json`:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "numReplicas": 1,
    "startCommand": "npm run start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

Create `Procfile`:

```
web: npm run start
```

### Set Environment Variables

```bash
# Set each variable
railway variables set NODE_ENV=production
railway variables set JWT_SECRET=your-production-secret
railway variables set JWT_REFRESH_SECRET=your-production-refresh-secret
railway variables set ENCRYPTION_KEY=your-encryption-key
railway variables set FACEBOOK_APP_ID=your-fb-app-id
railway variables set FACEBOOK_APP_SECRET=your-fb-app-secret
railway variables set FACEBOOK_REDIRECT_URI=https://your-domain.railway.app/api/auth/facebook/callback

# DATABASE_URL and REDIS_URL are auto-set by Railway
```

### Deploy

```bash
# Deploy to Railway
railway up

# Check logs
railway logs

# Get deployment URL
railway domain
```

### Run Database Migrations

```bash
# Connect to Railway project
railway link

# Run migrations
railway run npm run db:push
```

---

## 🔐 Part 7: Security Checklist

Before going live, ensure:

- [ ] All environment variables set correctly
- [ ] JWT secrets are strong and unique
- [ ] Database credentials are secure
- [ ] HTTPS is enabled (Railway does this automatically)
- [ ] CORS is configured for your domain only
- [ ] Rate limiting is enabled
- [ ] Facebook app is in Production mode
- [ ] Error messages don't leak sensitive info
- [ ] Logs don't contain passwords or tokens

---

## 📝 Part 8: Post-Deployment

### Monitor Application

```bash
# View logs in real-time
railway logs --follow

# Check health endpoint
curl https://your-domain.railway.app/health
```

### Setup Monitoring

1. Sign up for [Sentry](https://sentry.io)
2. Create new project
3. Add DSN to environment variables:
   ```bash
   railway variables set SENTRY_DSN=your-sentry-dsn
   ```

### Backup Database

```bash
# Export database
railway run pg_dump $DATABASE_URL > backup.sql

# Or use Railway dashboard → PostgreSQL → Backups
```

---

## 🆘 Troubleshooting

### Database Connection Issues

```bash
# Test database connection
npx prisma db pull
```

### Redis Connection Issues

```bash
# Test Redis
redis-cli -h your-redis-host -p 6379 ping
```

### Build Failures

```bash
# Clear cache and rebuild
rm -rf node_modules dist
npm install
npm run build
```

### Extension Not Loading

1. Check `manifest.json` is valid
2. Rebuild extension: `npm run build`
3. Reload extension in Chrome

---

## 📚 Next Steps

1. **Customize Landing Page** - Edit `frontend/src/pages/Landing.tsx`
2. **Configure FTP** - Add your DMS FTP credentials in dashboard
3. **Connect Facebook** - Authorize Facebook profiles
4. **Upload Inventory** - Import your first CSV file
5. **Test Posting** - Try posting a vehicle to marketplace

---

## 🎯 Quick Reference Commands

```bash
# Development
npm run dev                 # Start dev server
npm run db:studio          # Open database GUI

# Production
npm run build              # Build for production
npm start                  # Start production server

# Database
npm run db:push            # Push schema changes
npm run db:migrate         # Create migration

# Deployment
railway login              # Login to Railway
railway up                 # Deploy to Railway
railway logs              # View logs

# Testing
npm test                   # Run tests
npm run lint              # Lint code
```

---

## 💡 Tips

1. **Use Prisma Studio** for database debugging
2. **Check logs/** folder for error details
3. **Use Postman** for API testing
4. **Keep .env** secure - never commit it
5. **Test locally** before deploying

---

## 📞 Getting Help

- **Documentation**: Check README.md and code comments
- **Logs**: Review `logs/error.log` for errors
- **Database**: Use `npm run db:studio` to inspect data
- **Community**: Create GitHub issue for bugs

---

**Congratulations! 🎉 Your Dealers Face platform is ready!**
