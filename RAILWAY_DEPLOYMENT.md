# 🚂 Railway Deployment Guide for FaceMyDealer

## 📦 Repository Successfully Pushed to GitHub

✅ **GitHub Repository**: https://github.com/MangaiYashobeam/FMD.git

Your code is now live on GitHub with:
- Complete backend system
- Database schema
- All services and controllers
- Comprehensive documentation

---

## 🚀 Deploy to Railway

### Step 1: Create Railway Account

1. Go to [railway.app](https://railway.app)
2. Click "Login with GitHub"
3. Authorize Railway to access your repositories

### Step 2: Create New Project

1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Choose **`MangaiYashobeam/FMD`**
4. Railway will automatically detect the project

### Step 3: Add PostgreSQL Database

1. In your project dashboard, click **"+ New"**
2. Select **"Database"** → **"Add PostgreSQL"**
3. Railway will provision a PostgreSQL instance
4. The `DATABASE_URL` will be automatically set as an environment variable

### Step 4: Add Redis

1. Click **"+ New"** again
2. Select **"Database"** → **"Add Redis"**
3. Railway will provision a Redis instance
4. The `REDIS_URL` will be automatically set

### Step 5: Configure Environment Variables

In your Railway project → **Settings** → **Variables**, add these:

```env
NODE_ENV=production

# JWT Secrets (generate strong random strings)
JWT_SECRET=<generate-64-character-random-string>
JWT_REFRESH_SECRET=<generate-64-character-random-string>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Encryption Key (exactly 32 characters)
ENCRYPTION_KEY=<generate-32-character-random-string>

# Facebook OAuth (from developers.facebook.com)
FACEBOOK_APP_ID=<your-facebook-app-id>
FACEBOOK_APP_SECRET=<your-facebook-app-secret>
FACEBOOK_REDIRECT_URI=https://<your-railway-domain>.railway.app/api/auth/facebook/callback
FACEBOOK_GRAPH_API_VERSION=v18.0

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS (add your frontend domain when ready)
ALLOWED_ORIGINS=https://<your-railway-domain>.railway.app

# Optional - OpenAI for AI descriptions
OPENAI_API_KEY=<your-openai-key>

# Optional - Email service
EMAIL_FROM=noreply@facemydealer.com
SENDGRID_API_KEY=<your-sendgrid-key>

# Optional - Error tracking
SENTRY_DSN=<your-sentry-dsn>
```

**Generate Random Secrets in PowerShell:**
```powershell
# For JWT_SECRET (64 characters)
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | % {[char]$_})

# For ENCRYPTION_KEY (32 characters)
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})
```

### Step 6: Setup Database Schema

Railway will automatically run `npm install` and `npm run build`.

After deployment, you need to push the database schema:

**Option A: Using Railway CLI**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Push database schema
railway run npm run db:push
```

**Option B: Using Railway Dashboard**
1. Go to your project → **Deployments**
2. Click on the latest deployment
3. Go to **Settings** → **Deploy Trigger**
4. Add a custom deploy command: `npm run db:push && npm start`

### Step 7: Get Your Deployment URL

1. Go to **Settings** → **Domains**
2. Click **"Generate Domain"**
3. Railway will give you a URL like: `https://fmd-production-xxxx.up.railway.app`
4. Save this URL and update your `.env` Facebook redirect URI

### Step 8: Verify Deployment

Test your deployed API:

```bash
# Health check
curl https://your-railway-domain.railway.app/health

# Should return:
# {"status":"ok","timestamp":"...","uptime":...}
```

---

## 🔧 Railway Configuration Files

Your project already includes:

✅ **`railway.json`** - Railway deployment configuration
```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run build"
  },
  "deploy": {
    "startCommand": "npm run start",
    "restartPolicyType": "ON_FAILURE",
    "healthcheckPath": "/health"
  }
}
```

✅ **`Procfile`** - Process definition
```
web: npm run start
```

✅ **`package.json`** - Build scripts configured

---

## 📊 Post-Deployment Checklist

### Immediate Tasks
- [ ] Verify health endpoint works
- [ ] Check Railway logs for errors
- [ ] Test database connection
- [ ] Test Redis connection
- [ ] Register a test user via API
- [ ] Verify JWT authentication works

### Facebook App Configuration
1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Your App → Settings → Basic
3. Add your Railway domain to **App Domains**
4. Facebook Login → Settings
5. Add to **Valid OAuth Redirect URIs**:
   ```
   https://your-railway-domain.railway.app/api/auth/facebook/callback
   ```

### Database Management

**View/Edit Database:**
```bash
# Install Prisma CLI globally if not done
npm install -g prisma

# Open Prisma Studio (connected to production)
railway run npx prisma studio
```

**Create Migrations:**
```bash
# After schema changes
railway run npx prisma migrate deploy
```

---

## 🔍 Monitoring & Logs

### View Logs
```bash
# Real-time logs via CLI
railway logs --follow

# Or in Railway Dashboard → Your Service → Logs
```

### Metrics
Railway Dashboard shows:
- CPU usage
- Memory usage
- Request count
- Response times

### Error Tracking (Optional)

**Setup Sentry:**
1. Create account at [sentry.io](https://sentry.io)
2. Create new Node.js project
3. Copy DSN
4. Add to Railway environment variables:
   ```
   SENTRY_DSN=your-sentry-dsn
   ```

---

## 🔄 Continuous Deployment

Railway automatically deploys when you push to GitHub:

```bash
# Make changes locally
git add .
git commit -m "Add new feature"
git push origin main

# Railway automatically:
# 1. Detects the push
# 2. Runs npm install
# 3. Runs npm run build
# 4. Deploys new version
# 5. Runs health checks
```

---

## 💰 Railway Pricing

**Starter Plan (Free):**
- $5 free credits/month
- Good for development/testing
- Sleeps after inactivity

**Developer Plan ($20/month):**
- $20 included usage
- No sleep
- Better for production

**Pro Plan (Usage-based):**
- Pay per resource
- Best for production with traffic

---

## 🐛 Troubleshooting

### Build Fails
```bash
# Check logs
railway logs

# Common issues:
# 1. Missing dependencies in package.json
# 2. TypeScript errors
# 3. Environment variables not set
```

### Database Connection Fails
```bash
# Verify DATABASE_URL is set
railway variables

# Test connection
railway run npx prisma db pull
```

### App Crashes on Start
```bash
# Check start command
railway logs

# Ensure npm run start works locally
npm run build
npm start
```

### Redis Connection Issues
```bash
# Verify Redis is provisioned
railway variables | grep REDIS

# Check connection in logs
railway logs --follow
```

---

## 🚀 Next Steps After Deployment

1. **Test API Endpoints**
   ```bash
   # Register user
   curl -X POST https://your-domain.railway.app/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"Test123!","firstName":"John","lastName":"Doe","accountName":"Test Dealer"}'
   ```

2. **Setup Frontend**
   - Create React app
   - Configure API_BASE_URL to point to Railway
   - Deploy frontend to Vercel/Netlify

3. **Build Chrome Extension**
   - Update extension to use Railway API
   - Test authentication flow

4. **Configure Facebook App**
   - Complete OAuth setup
   - Request necessary permissions
   - Test Facebook integration

---

## 📞 Support

**Railway Issues:**
- [Railway Docs](https://docs.railway.app)
- [Railway Discord](https://discord.gg/railway)
- [Railway Status](https://status.railway.app)

**Project Issues:**
- GitHub: https://github.com/MangaiYashobeam/FMD/issues
- Check logs: `railway logs`
- Review documentation in repo

---

## ✅ Deployment Complete!

Your FaceMyDealer backend is now:
- ✅ Deployed on Railway
- ✅ Connected to PostgreSQL
- ✅ Connected to Redis
- ✅ Auto-deploys from GitHub
- ✅ Production-ready

**Your URLs:**
- **GitHub**: https://github.com/MangaiYashobeam/FMD
- **Railway API**: https://your-domain.railway.app
- **Health Check**: https://your-domain.railway.app/health

---

**Congratulations! 🎉**

Your backend is live and ready for development!
