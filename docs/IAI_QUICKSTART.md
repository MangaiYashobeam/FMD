# IAI Command Center - Quick Start Guide

## 🚀 5-Minute Setup

### Step 1: Access the Dashboard
1. Log in to DealersFace admin panel
2. Navigate to **IAI Command** in the left sidebar (⚡ icon)
3. You should see the IAI Command Center dashboard

### Step 2: Activate Your First IAI Soldier

#### For Chrome Extension Users:
1. **Open Chrome** and load the DealersFace extension
2. **Click the extension icon** and open the side panel
3. **Log in** with your Facebook account (OAuth flow)
4. **Wait 5 seconds** - Check console logs (F12) for:
   ```
   🚀 IAI SOLDIER IAI-0 WAKING UP - Starting aggressive task polling...
   ✅ IAI Soldier registered: IAI-0
   ```
5. **Return to dashboard** - Your soldier should appear within 10 seconds!

### Step 3: Verify It's Working

#### In the Extension Console (chrome://extensions → Details → Inspect views: service worker):
Look for these logs:
```javascript
✅ IAI Soldier registered: IAI-0
💓 IAI Soldier IAI-0 heartbeat - Still alive and polling
🔍 [19:30:15] IAI SOLDIER CHECKING FOR TASKS (account: xxx)...
```

#### In the Dashboard:
- **Total Soldiers**: Should show 1+
- **Online Soldiers**: Should show your soldier
- **Soldier Card**: Click to see detailed information

### Step 4: Monitor Activity

1. **Click on your soldier card** to open the detail modal
2. **Switch to Activity tab** to see real-time logs:
   - `status_change` - Soldier came online
   - `heartbeat` - Regular status pings
   - `task_start` - When tasks begin
   - `task_complete` - When tasks finish

3. **Switch to Performance tab** to see metrics:
   - Tasks completed/failed
   - Average duration
   - Status history

### Common Issues & Solutions

#### Issue: Extension Not Registering
**Symptoms:** No soldiers appear in dashboard after 30 seconds

**Solutions:**
1. Open extension console: `chrome://extensions` → Find "DealersFace Pro" → Click "service worker"
2. Look for errors in console
3. Check if logged in: Run `chrome.storage.local.get(['authState'])` in console
4. If not authenticated:
   - Open side panel
   - Click "Log in with Facebook"
   - Complete OAuth flow
   - Wait for "✅ Authentication successful"

#### Issue: Token Expired (401 Errors)
**Symptoms:** Extension logs show "❌ Token expired"

**Solutions:**
1. Reload the extension: `chrome://extensions` → Click reload (⟳)
2. Re-authenticate: Open side panel → Log in again
3. Verify success: Check for "IAI SOLDIER WAKING UP" in console

#### Issue: Soldier Shows Offline
**Symptoms:** Soldier status is "offline" in dashboard

**Solutions:**
1. Check last heartbeat timestamp
2. If > 2 minutes ago:
   - Extension may be sleeping (Chrome throttles)
   - Reload extension
   - Open Facebook tab to wake service worker
3. If still offline:
   - Check extension console for errors
   - Verify internet connection
   - Check Chrome updates (may require extension update)

#### Issue: No Activity Logs
**Symptoms:** Activity tab is empty

**Solutions:**
1. Verify soldier registration: Check if `soldierInfo` exists in console
2. Manually trigger activity:
   - Open Facebook Marketplace
   - Create/edit a listing
   - Check if extension intercepts the action
3. Check database: Run query to verify logs exist
   ```sql
   SELECT * FROM iai_activity_logs WHERE soldier_id = 'soldier-uuid';
   ```

## 🎯 Expected Behavior

### Normal Operation Timeline

**T+0s (Startup):**
- Extension loads background-ai.js
- Initializes IAI soldier state

**T+5s (Authentication Check):**
- Checks for stored authState
- If authenticated, proceeds to registration
- If not, waits for user to log in

**T+10s (Registration):**
- Fetches IP geolocation (ipapi.co)
- POSTs to `/api/extension/iai/register`
- Receives soldier ID (e.g., IAI-0)
- Stores in chrome.storage.local

**T+15s (Activation):**
- Starts task polling (every 5s)
- Starts heartbeat monitoring (every 30s)
- Updates badge to "ON" (green)
- Logs "IAI SOLDIER IAI-0 WAKING UP"

**T+30s (First Heartbeat):**
- POSTs to `/api/extension/iai/heartbeat`
- Sends status, location, CPU/memory
- Updates dashboard in real-time

**T+45s (Ongoing):**
- Polls for tasks every 5 seconds
- Heartbeat every 30 seconds
- Logs all activities
- Dashboard auto-refreshes every 5 seconds

### Dashboard Refresh Intervals

- **Soldier List**: 5 seconds
- **System Stats**: 10 seconds
- **Activity Logs**: 10 seconds (when modal open)
- **Performance Snapshots**: 30 seconds (when modal open)

## 📊 What Each Metric Means

### Soldier Status
- **Online** 🟢 - Active, ready for tasks
- **Working** 🔵 - Currently executing a task
- **Idle** 🟡 - Online but inactive
- **Offline** ⚪ - No heartbeat > 2 minutes
- **Error** 🔴 - Last operation failed

### Performance Metrics
- **Completed** - Total tasks finished successfully
- **Failed** - Total tasks that encountered errors
- **Success Rate** - (Completed ÷ Total) × 100
- **Avg Duration** - Mean time per task in seconds
- **Last Seen** - Time since last heartbeat

### Activity Event Types
- **heartbeat** - Regular 30s status ping
- **task_start** - Task execution begins
- **task_complete** - Task finished successfully
- **task_fail** - Task encountered error
- **status_change** - Status transition (e.g., offline → online)
- **error** - General error occurred

## 🔐 Security Notes

### Access Control
- IAI Command Center requires **Super Admin** role
- Regular users cannot access `/admin/iai-command`
- All API endpoints require valid JWT token
- Tokens expire after 24 hours (configurable)

### Data Privacy
- Geolocation is IP-based (no GPS)
- Browser IDs are anonymous UUIDs
- Activity logs are encrypted in transit (HTTPS)
- Sensitive data (tokens) never logged

### Best Practices
1. **Log out when done** - Prevents unauthorized access
2. **Monitor for suspicious activity** - Check error soldiers
3. **Review logs weekly** - Look for anomalies
4. **Keep extension updated** - Security patches
5. **Use strong passwords** - Protect admin account

## 🎓 Training Mode

### Test Your Setup

1. **Soldier Registration Test**
   - Expected: Soldier appears in dashboard within 30s
   - If fails: Check extension console for errors

2. **Heartbeat Test**
   - Expected: "Last seen" updates every ~30s
   - If fails: Check network tab for POST requests

3. **Activity Logging Test**
   - Expected: Events appear in Activity tab
   - Trigger: Refresh extension or create FB post
   - If fails: Check database for inserted records

4. **Task Execution Test**
   - Expected: Status changes to "working" when task starts
   - Trigger: Create pending task in database
   - If fails: Check task polling logs

### Success Criteria
✅ Soldier registered with unique ID (IAI-0)
✅ Dashboard shows soldier as "online"
✅ Heartbeat updates every 30 seconds
✅ Activity logs appear in real-time
✅ Performance metrics calculate correctly
✅ No errors in extension console
✅ No errors in API logs

## 📞 Getting Help

### Debug Checklist
- [ ] Extension installed and enabled
- [ ] Service worker running (not stopped)
- [ ] Authenticated with valid token
- [ ] API server responding (200 status)
- [ ] Database tables exist (iai_*)
- [ ] Network connectivity stable
- [ ] Browser console shows no errors

### Diagnostic Commands

**Check Extension Status:**
```javascript
// In extension console
chrome.storage.local.get(['authState', 'soldierInfo', 'browserId'])
```

**Check API Health:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://dealersface.com/api/admin/iai/stats
```

**Check Database:**
```sql
-- Count soldiers
SELECT COUNT(*) FROM iai_soldiers;

-- Recent activity
SELECT * FROM iai_activity_logs 
ORDER BY created_at DESC LIMIT 10;

-- Performance snapshots
SELECT * FROM iai_performance_snapshots 
ORDER BY snapshot_at DESC LIMIT 10;
```

### Support Resources
- **Documentation**: `/docs/IAI_COMMAND_CENTER.md`
- **API Reference**: In documentation
- **Console Logs**: Chrome DevTools (F12)
- **Database Logs**: `docker logs facemydealer-api-1`

## 🎉 Success!

If you see your soldier in the dashboard with a green "online" status and regular heartbeat updates, congratulations! Your IAI Command Center is fully operational.

**Next Steps:**
1. Add more soldiers (install extension on other browsers/machines)
2. Create automation tasks
3. Monitor performance metrics
4. Set up alerts (future feature)
5. Export reports (future feature)

---

**Remember**: The system is designed to be self-healing. If a soldier goes offline, it will automatically re-register when the extension restarts.

**Happy Automating! 🚀**
