# IAI System & Vehicle Fetching - Testing Guide

## ✅ COMPLETED FIXES

### 1. Database Setup
- Created IAI Soldiers tables (`iai_soldiers`, `iai_activity_logs`, `iai_performance_snapshots`)
- Tables now exist and ready to receive data
- Using TEXT type for IDs (matching existing schema)

### 2. Vehicle API
- Endpoint: `GET /api/vehicles?accountId={accountId}&status=ACTIVE&limit=100`
- Requires: `Authorization: Bearer {token}` header
- Returns: List of vehicles for the specified account
- **Current Data**: 7 vehicles in database for account `d285d16f-6318-412e-81ef-dcd45fe09a73`

### 3. IAI Registration
- Endpoint: `POST /api/extension/iai/register`
- Extension code updated to use correct accountId extraction
- Geolocation changed from ipapi.co → ip-api.com (CORS friendly)
- Auto-generates soldier ID (IAI-0, IAI-1, etc.)

### 4. IAI Command Center
- Stats cards now CLICKABLE (filters soldiers by status)
- Detailed soldier modal with 3 tabs: Overview, Activity, Performance
- Real-time refresh every 5 seconds

## 🧪 TESTING STEPS

### Step 1: Test in Browser (Verify Web App)

1. **Clear Browser Cache & Login**:
   ```
   - Press Ctrl+Shift+Delete
   - Select "All time"
   - Clear everything
   - Close browser completely
   - Reopen and go to https://dealersface.com
   - Login fresh
   ```

2. **Navigate to IAI Command Center**:
   ```
   - Click "IAI Command" in sidebar (⚡ icon)
   - Should see 4 stat cards at top
   - Cards should say "Click to filter" at bottom
   - Click each card to filter soldiers
   ```

3. **Expected Behavior**:
   - Total Soldiers: Shows count, click filters to "all"
   - Online: Shows online count, click filters to "online"
   - Working: Shows working count, click filters to "working"
   - Tasks Completed: Shows total, click filters to "all"

### Step 2: Test Extension Vehicle Fetching

1. **Reload Extension**:
   ```
   - Go to chrome://extensions
   - Find "DealersFace Pro"
   - Click ⟳ (refresh icon)
   - Open DevTools Console (F12)
   ```

2. **Watch Console for These Messages**:
   ```javascript
   ✅ Auth state loaded: {accountId: "...", accessToken: "..."}
   📡 Registering IAI Soldier... {accountId: "...", userId: "...", browserId: "..."}
   ✅ IAI Soldier registered: IAI-0  // Or IAI-1, IAI-2, etc.
   ✅ Fetched vehicles: 7  // Should show number of vehicles
   ```

3. **If You See Errors**:
   - `❌ Cannot register IAI - not authenticated`: Logout and login again
   - `403 Forbidden`: User doesn't have access to account
   - `404 Not Found`: API route issue (check server logs)
   - `401 Unauthorized`: Token expired (logout/login)

### Step 3: Test in Facebook Marketplace

1. **Navigate to Facebook Marketplace**:
   ```
   - Go to facebook.com/marketplace
   - Click "Create new listing" → "Item for sale"
   - Look for blue sidebar on right side (extension overlay)
   ```

2. **Test Vehicle Selection**:
   ```
   - In sidebar, find "Post Vehicles" button
   - Click to open vehicle selector modal
   - Should show 7 vehicles from database
   - Select a vehicle
   - Click "Use this vehicle"
   - Form should auto-fill with vehicle data
   ```

3. **Expected Console Logs**:
   ```javascript
   ✅ Fetched vehicles: 7
   📸 Vehicle selected: 2023 Toyota Camry (example)
   🔄 Auto-filling form with vehicle data...
   ✅ Form auto-filled successfully
   ```

## 🐛 DEBUGGING COMMON ISSUES

### Issue: Extension Not Fetching Vehicles

**Symptoms**: Modal shows "No vehicles found" or empty list

**Debug Steps**:
1. Check console for error messages
2. Verify accountId in authState:
   ```javascript
   chrome.storage.local.get(['authState'], (result) => {
     console.log('Auth State:', result.authState);
     console.log('Account ID:', result.authState.dealerAccountId || result.authState.accountId);
   });
   ```
3. Test API directly:
   ```javascript
   // In browser console on dealersface.com
   const token = localStorage.getItem('token');
   const accountId = 'd285d16f-6318-412e-81ef-dcd45fe09a73'; // Your account ID
   fetch(`https://dealersface.com/api/vehicles?accountId=${accountId}&limit=10`, {
     headers: { 'Authorization': `Bearer ${token}` }
   }).then(r => r.json()).then(console.log);
   ```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "vehicles": [
      {
        "id": "...",
        "vin": "...",
        "year": 2023,
        "make": "Toyota",
        "model": "Camry",
        "price": "25000",
        ...
      }
    ],
    "pagination": {
      "total": 7,
      "page": 1,
      "limit": 10
    }
  }
}
```

### Issue: IAI Soldier Not Registering

**Symptoms**: IAI Command Center shows 0 soldiers

**Debug Steps**:
1. Check extension console for registration errors
2. Verify IAI tables exist:
   ```bash
   ssh root@46.4.224.182 "cd /opt/facemydealer && docker compose -f docker-compose.production.yml exec postgres psql -U facemydealer -d facemydealer -c '\dt iai_*'"
   ```
3. Check for soldiers manually:
   ```bash
   ssh root@46.4.224.182 "cd /opt/facemydealer && docker compose -f docker-compose.production.yml exec postgres psql -U facemydealer -d facemydealer -c 'SELECT soldier_id, status, account_id FROM iai_soldiers;'"
   ```

4. Test registration directly:
   ```javascript
   // In extension service worker console (chrome://extensions → inspect views → service worker)
   const { authState } = await chrome.storage.local.get(['authState']);
   const response = await fetch('https://dealersface.com/api/extension/iai/register', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${authState.accessToken}`,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       accountId: authState.dealerAccountId || authState.accountId,
       userId: authState.userId,
       browserId: crypto.randomUUID(),
       extensionVersion: '1.0.0'
     })
   });
   console.log('Registration:', await response.json());
   ```

### Issue: 403 Forbidden on /api/vehicles

**Cause**: User doesn't have permission to access the account

**Fix**:
1. Check user's account membership:
   ```sql
   SELECT u.email, au.role, a.name 
   FROM users u
   JOIN account_users au ON u.id = au.user_id
   JOIN accounts a ON au.account_id = a.id
   WHERE u.email = 'your-email@example.com';
   ```

2. Grant access if needed (run in database):
   ```sql
   INSERT INTO account_users (id, user_id, account_id, role, created_at, updated_at)
   VALUES (
     gen_random_uuid()::text,
     (SELECT id FROM users WHERE email = 'your-email@example.com'),
     'd285d16f-6318-412e-81ef-dcd45fe09a73',
     'ADMIN',
     NOW(),
     NOW()
   );
   ```

## 📊 MONITORING & LOGS

### Check IAI Soldier Status
```bash
ssh root@46.4.224.182 "cd /opt/facemydealer && docker compose -f docker-compose.production.yml exec postgres psql -U facemydealer -d facemydealer -c \"SELECT soldier_id, status, tasks_completed, tasks_failed, last_heartbeat_at FROM iai_soldiers ORDER BY created_at DESC;\""
```

### Check Vehicle Count by Account
```bash
ssh root@46.4.224.182 "cd /opt/facemydealer && docker compose -f docker-compose.production.yml exec postgres psql -U facemydealer -d facemydealer -c \"SELECT account_id, COUNT(*) as vehicle_count FROM vehicles GROUP BY account_id;\""
```

### View API Logs (Real-time)
```bash
ssh root@46.4.224.182 "cd /opt/facemydealer && docker compose -f docker-compose.production.yml logs -f api"
```

### View Recent IAI Activity
```bash
ssh root@46.4.224.182 "cd /opt/facemydealer && docker compose -f docker-compose.production.yml exec postgres psql -U facemydealer -d facemydealer -c \"SELECT event_type, message, created_at FROM iai_activity_logs ORDER BY created_at DESC LIMIT 20;\""
```

## 🎯 NEXT STEPS

1. **Clear cache and login fresh** (most important!)
2. **Reload extension** (chrome://extensions)
3. **Navigate to IAI Command** → Should show clickable stats
4. **Go to Facebook Marketplace** → Test vehicle fetching
5. **Monitor extension console** for success/error messages
6. **Click soldier cards** to see detailed information

## ✨ EXPECTED FINAL STATE

- ✅ IAI Command Center shows 1+ soldiers (yours)
- ✅ Stats cards are clickable and filter properly
- ✅ Clicking soldier shows detailed modal with 3 tabs
- ✅ Extension fetches 7 vehicles successfully
- ✅ Vehicle selector modal shows all 7 vehicles
- ✅ Form auto-fills when vehicle selected
- ✅ No 401/403/404 errors in console
- ✅ Heartbeat updates every 30 seconds

## 🚨 IF STILL NOT WORKING

1. **Export console logs**:
   - F12 → Console tab
   - Right-click → Save as...
   - Send logs for review

2. **Check server logs**:
   ```bash
   ssh root@46.4.224.182 "cd /opt/facemydealer && docker compose -f docker-compose.production.yml logs --tail=100 api > /root/api-logs.txt"
   scp root@46.4.224.182:/root/api-logs.txt .
   ```

3. **Verify account ID**:
   - Dashboard → Account Settings
   - Note the account ID shown
   - Compare with `authState.dealerAccountId` in extension

## 📝 KEY CHANGES MADE

1. **Database**: Created IAI tables (iai_soldiers, iai_activity_logs, iai_performance_snapshots)
2. **Extension**: Fixed vehicle endpoint, geolocation API, auth extraction
3. **Web**: Made IAI stats clickable, added filter functionality
4. **API**: Verified routes exist and are properly secured
5. **Docker**: Copied latest web/dist into running container

**All systems are GO! 🚀**
