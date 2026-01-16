# Railway Database Setup Guide

Complete guide to setting up PostgreSQL and Redis databases on Railway and connecting them to your Dealers Face application.

## 📋 Prerequisites

- Railway account (https://railway.app)
- GitHub repository connected to Railway
- Your project already pushed to GitHub

## 🚀 Step 1: Create Railway Project

1. **Login to Railway**
   - Go to https://railway.app
   - Sign in with your GitHub account

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository: `MangaiYashobeam/FMD`
   - Railway will auto-detect it as a Node.js project

## 🗄️ Step 2: Add PostgreSQL Database

1. **Add PostgreSQL Service**
   - In your Railway project dashboard
   - Click "New" → "Database" → "Add PostgreSQL"
   - Railway will automatically provision a PostgreSQL database

2. **Get Database Connection String**
   - Click on the PostgreSQL service
   - Go to "Connect" tab
   - Copy the `DATABASE_URL` (looks like this):
     ```
     postgresql://postgres:password@containers-us-west-xxx.railway.app:1234/railway
     ```

3. **Add to Your Service**
   - Click on your main service (FMD)
   - Go to "Variables" tab
   - Railway automatically adds `DATABASE_URL` if services are in same project
   - If not, manually add:
     - Variable: `DATABASE_URL`
     - Value: [paste the connection string]

## 🔴 Step 3: Add Redis Database

1. **Add Redis Service**
   - Click "New" → "Database" → "Add Redis"
   - Railway will provision a Redis instance

2. **Get Redis Connection Details**
   - Click on the Redis service
   - Go to "Connect" tab
   - You'll see:
     - `REDIS_URL` (full connection string)
     - Host, Port, and Password

3. **Add Redis Variables to Your Service**
   - Go to your main service → "Variables"
   - Add these variables:
     ```
     REDIS_HOST=containers-us-west-xxx.railway.app
     REDIS_PORT=6379
     REDIS_PASSWORD=your-redis-password
     ```

## 🔐 Step 4: Add Environment Variables

In your main service's "Variables" tab, add all required environment variables:

### Required Variables

```env
# Server
NODE_ENV=production
PORT=3000
API_URL=https://your-app.railway.app

# Database (auto-added by Railway)
DATABASE_URL=postgresql://...

# Redis
REDIS_HOST=your-redis-host.railway.app
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# JWT Secrets (generate strong random strings)
JWT_SECRET=generate-a-strong-random-string-here
JWT_REFRESH_SECRET=generate-another-strong-random-string-here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Facebook OAuth
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret

# Security
CORS_ORIGIN=*
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
LOG_LEVEL=info
```

### How to Generate Strong Secrets

Use one of these methods:

**Option 1: Node.js**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Option 2: OpenSSL**
```bash
openssl rand -hex 32
```

**Option 3: Online Generator**
- Visit: https://randomkeygen.com/
- Use "Fort Knox Passwords" section

## 🔨 Step 5: Run Database Migrations

1. **Install Railway CLI (Optional but Recommended)**
   ```bash
   npm install -g @railway/cli
   railway login
   railway link
   ```

2. **Run Prisma Migrations**

   **Option A: Using Railway CLI**
   ```bash
   railway run npm run db:push
   ```

   **Option B: Using Railway Dashboard**
   - Go to your service → "Settings"
   - Add to "Build Command":
     ```
     npm install && npm run build && npx prisma generate
     ```
   - Add to "Deploy Command" (one-time):
     ```
     npx prisma db push && npm start
     ```
   - After first successful deployment, change back to just:
     ```
     npm start
     ```

3. **Verify Migration**
   - Check deployment logs
   - Should see: "The database is now in sync with your Prisma schema"

## 🌐 Step 6: Get Your Deployment URL

1. **Find Your App URL**
   - In Railway dashboard → Your service
   - Go to "Settings" → "Networking"
   - Click "Generate Domain"
   - Your app will be available at: `https://your-app-name.up.railway.app`

2. **Update API_URL Variable**
   - Go to "Variables" tab
   - Update `API_URL` with your actual Railway domain:
     ```
     API_URL=https://your-app-name.up.railway.app
     ```

## ✅ Step 7: Test Your Deployment

### Test Health Endpoint
```bash
curl https://your-app.railway.app/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-01-14T...",
  "uptime": 123.45
}
```

### Test User Registration
```bash
curl -X POST https://your-app.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "firstName": "Test",
    "lastName": "User",
    "accountName": "Test Dealership"
  }'
```

## 🔧 Step 8: Database Management

### View Database (Railway Dashboard)
1. Click on PostgreSQL service
2. Go to "Data" tab
3. Browse tables and data

### Connect Locally to Railway Database

**Using Prisma Studio:**
```bash
# Set DATABASE_URL locally
export DATABASE_URL="postgresql://..."

# Open Prisma Studio
npx prisma studio
```

**Using psql:**
```bash
psql "postgresql://postgres:password@host:port/railway"
```

## 📊 Monitoring & Logs

### View Application Logs
- Railway Dashboard → Your service → "Deployments"
- Click on latest deployment
- View real-time logs

### View Database Metrics
- PostgreSQL service → "Metrics"
- Monitor connections, queries, storage

### View Redis Metrics
- Redis service → "Metrics"
- Monitor memory usage, commands

## 🚨 Troubleshooting

### Issue: "Cannot connect to database"
**Solution:**
- Verify `DATABASE_URL` in Variables tab
- Check PostgreSQL service is running
- Ensure services are in same project (they share private network)

### Issue: "Redis connection failed"
**Solution:**
- Verify REDIS_HOST, REDIS_PORT, REDIS_PASSWORD
- Check Redis service status
- Test connection from logs

### Issue: "Migration failed"
**Solution:**
```bash
# Use Railway CLI to run migrations manually
railway run npx prisma db push --force-reset
railway run npx prisma generate
```

### Issue: "Build fails"
**Solution:**
- Check build logs in Railway dashboard
- Ensure all dependencies in package.json
- Verify Node.js version in package.json engines field

## 🔄 Continuous Deployment

Railway automatically deploys when you push to GitHub:

1. **Make changes locally**
   ```bash
   git add .
   git commit -m "Your changes"
   git push origin main
   ```

2. **Railway auto-deploys**
   - Monitors your GitHub repo
   - Builds and deploys automatically
   - Zero-downtime deployments

## 💡 Best Practices

1. **Secrets Management**
   - Never commit .env files
   - Use Railway's Variables for all secrets
   - Rotate JWT secrets periodically

2. **Database Backups**
   - Railway auto-backs up PostgreSQL
   - Access backups in PostgreSQL service → "Backups"

3. **Scaling**
   - Monitor usage in Railway dashboard
   - Upgrade plan if needed
   - Consider adding replicas for high traffic

4. **Cost Optimization**
   - Free tier: $5/month credit
   - Monitor usage to avoid overages
   - Delete unused services

## 📞 Need Help?

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Prisma Docs: https://www.prisma.io/docs

## ✨ Next Steps

After database setup:
1. ✅ Configure Facebook OAuth app
2. ✅ Test all API endpoints
3. ✅ Set up auto-sync scheduler
4. ✅ Build frontend dashboard
5. ✅ Deploy Chrome extension

---

**Status:** Your backend is now production-ready! 🎉
