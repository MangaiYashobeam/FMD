# FaceMyDealer - Railway Deployment Guide

## Prerequisites
- Railway account connected to GitHub (https://railway.app)
- GitHub repository: https://github.com/MangaiYashobeam/FMD.git
- PostgreSQL and Redis add-ons provisioned in Railway

## Environment Variables

### Required Variables (Must Configure in Railway)

#### Database & Cache
```bash
DATABASE_URL=postgresql://user:password@host:port/database
REDIS_HOST=containers-us-west-xxx.railway.app
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
```

#### Authentication & Security
```bash
JWT_SECRET=;3GDrA"]2&,&!w5@3L`oxxYSWC'?RtJh<wM#YN,}O{0y95EI;st1t_u\J7+XVNC?
JWT_REFRESH_SECRET=>y{4d0YCSm~)&>e~cJ8&D^b(T9{]S.+aWH-PWS.4)o2F_qKe}\j`x<FFx'N'.Pg%
FB_CREDENTIALS_KEY=4d4a0e9d9f7d709dca9f426c2c1229bf566c5486cd7ca2b3b431709def5daf8b
```

#### Server Configuration
```bash
NODE_ENV=production
PORT=3000
API_URL=https://your-railway-app.up.railway.app
```

#### Facebook OAuth (Optional - for Groups posting)
```bash
# Create app at https://developers.facebook.com/apps
FACEBOOK_APP_ID=your-app-id
FACEBOOK_APP_SECRET=your-app-secret
FACEBOOK_REDIRECT_URI=https://your-railway-app.up.railway.app/api/auth/facebook/callback
```

## Deployment Steps

### 1. Configure Railway Project

1. Create new project in Railway
2. Connect to GitHub repository: `MangaiYashobeam/FMD`
3. Add PostgreSQL plugin
4. Add Redis plugin
5. Configure environment variables (see above)

### 2. Initialize Database

After first deployment:

```bash
# In Railway terminal
npm run db:push
```

This will:
- Create all database tables from Prisma schema
- Set up relationships and indexes
- Initialize the database for production use

### 3. Verify Deployment

Check logs for successful startup messages:

```
✅ PostgreSQL connected successfully!
✅ Queue processor initialized
🚀 Auto-sync scheduler started (runs every hour)
🚀 Server running on port 3000
```

### 4. Test Auto-Sync Scheduler

Monitor logs for hourly auto-sync checks:

```
🔍 Checking accounts for auto-sync...
Found X accounts with auto-sync enabled
✅ Auto-sync check complete: X queued, X skipped
```

## Auto-Sync Scheduler Configuration

### How It Works

1. **Cron Schedule**: Runs every hour on the hour (`0 * * * *`)
2. **Account Selection**: Checks accounts where:
   - `isActive = true`
   - `autoSync = true`
   - FTP credentials configured (`ftpHost`, `ftpUsername`, `csvPath`)
3. **Sync Interval**: Default 3 hours per account (configurable via `Account.syncInterval`)
4. **Queue Management**: Creates `SyncJob` with `triggeredBy = 'AUTO'`

### Monitoring

**Get scheduler status:**
```bash
GET /api/sync/scheduler/status
Authorization: Bearer <token>

Response:
{
  "initialized": true,
  "activeJobs": ["auto-sync"],
  "nextRun": "Every hour on the hour (0 * * * *)"
}
```

**View sync history:**
```bash
GET /api/sync/history?accountId=<id>
Authorization: Bearer <token>
```

### Manual Sync

Trigger manual sync for specific account:

```bash
POST /api/sync/manual
Authorization: Bearer <token>
Content-Type: application/json

{
  "accountId": "account-uuid-here"
}
```

## Chrome Extension Setup

### 1. Prepare Extension Files

The extension is located in `chrome-extension/` directory:

```
chrome-extension/
├── manifest.json
├── background.js
├── content.js
├── popup.html
├── popup.js
└── README.md
```

### 2. Create Extension Icons

Create placeholder icons in `chrome-extension/icons/`:

```bash
# Create icons directory
mkdir chrome-extension/icons

# Generate placeholder icons (16x16, 48x48, 128x128)
# You can use any image editor or online tool
```

### 3. Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select the `chrome-extension/` directory
5. Extension should appear in toolbar

### 4. Configure Extension

1. Click extension icon in toolbar
2. Enter backend URL: `https://your-railway-app.up.railway.app`
3. Click "Login"
4. Enter your FaceMyDealer credentials
5. Extension will fetch encrypted Facebook credentials

### 5. Test Marketplace Posting

1. Navigate to Facebook Marketplace
2. Click "Create new listing" → "Item for sale"
3. Extension auto-fills form with vehicle data
4. Review and confirm posting
5. Extension sends confirmation to backend

## Security Checklist

- [x] All secrets generated (JWT, encryption key)
- [x] Facebook credentials encrypted with AES-256-CBC
- [x] HTTPS-only in production
- [x] Audit logging for credential operations
- [x] JWT tokens with expiration
- [x] Environment variables secured in Railway
- [ ] Enable Railway's "Private Networking" for database/Redis
- [ ] Set up Railway's "Custom Domain" with SSL
- [ ] Configure CORS for production domain
- [ ] Enable rate limiting in production

## Monitoring & Logs

### Key Logs to Monitor

**Scheduler Activity:**
- `🔍 Checking accounts for auto-sync...`
- `✅ Auto-sync check complete: X queued, X skipped`
- `📋 Auto-sync job <id> queued for "<account>"`

**Sync Processing:**
- `Processing sync job: <id>`
- `✅ Sync completed: X imported, X updated, X failed`
- `❌ Sync failed: <error message>`

**Chrome Extension:**
- `Extension: Login successful`
- `Extension: Credentials fetched`
- `Extension: Auto-fill completed`
- `Extension: Post confirmed`

### Railway Dashboard

Monitor in Railway dashboard:
- **Deployments**: Check build/deploy status
- **Metrics**: CPU, memory, network usage
- **Logs**: Real-time application logs
- **Database**: PostgreSQL connection info
- **Redis**: Cache statistics

## Troubleshooting

### Build Fails

1. Check TypeScript errors in Railway logs
2. Verify all dependencies in `package.json`
3. Ensure `npm run build` succeeds locally

### Database Connection Issues

1. Verify `DATABASE_URL` format
2. Check PostgreSQL plugin status
3. Try connecting with `npm run db:push`

### Scheduler Not Running

1. Check logs for "Auto-sync scheduler started"
2. Verify `autoSync = true` on test account
3. Check FTP credentials configured
4. Test manual sync first: `POST /api/sync/manual`

### Extension Not Working

1. Verify backend URL in extension popup
2. Check login credentials
3. View extension console: `chrome://extensions/` → Extension Details → "Inspect views: service worker"
4. Check Facebook credential encryption

## Next Steps

1. **Dashboard Development**: Build React frontend for user management
2. **Facebook App Review**: Submit for Groups posting permissions
3. **Extension Icons**: Create professional icons (16px, 48px, 128px)
4. **Testing**: End-to-end testing with real dealership data
5. **Documentation**: User guides for sales team

## Support

- **Backend Issues**: Check Railway logs
- **Extension Issues**: Check browser console and service worker
- **Database Issues**: Use Prisma Studio (`npx prisma studio`)
- **Sync Issues**: Review sync job logs in database

---

**Repository**: https://github.com/MangaiYashobeam/FMD.git  
**Documentation**: See `docs/` directory for architecture and API details
