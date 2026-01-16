# Facebook Posting Architecture - Dual Approach

## 🎯 System Overview

Dealers Face implements a **dual posting system** to maximize reach:

1. **Facebook Groups** (API-based) - Automated backend posting
2. **Personal Facebook Marketplace** (Extension-based) - Browser automation

---

## 📊 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     DEALERS FACE PLATFORM                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐ │
│  │   Vehicle    │      │   Sales Rep  │      │   Dealer     │ │
│  │  Inventory   │─────▶│   Dashboard  │◀─────│   Account    │ │
│  │  (CSV/FTP)   │      │              │      │              │ │
│  └──────────────┘      └──────┬───────┘      └──────────────┘ │
│                               │                                │
│                       ┌───────┴────────┐                       │
│                       │                │                       │
│                       ▼                ▼                       │
│              ┌────────────────┐  ┌────────────────┐          │
│              │ GROUP POSTING  │  │  MARKETPLACE   │          │
│              │   (API-Based)  │  │  (Extension)   │          │
│              └────────┬───────┘  └────────┬───────┘          │
└───────────────────────┼──────────────────┼───────────────────┘
                        │                  │
                        ▼                  ▼
              ┌──────────────────┐  ┌──────────────────┐
              │  Facebook Graph  │  │ Chrome Extension │
              │       API        │  │  (Automation)    │
              │                  │  │                  │
              │  • Group Posts   │  │ • Form Filling  │
              │  • OAuth Token   │  │ • Auto-Submit   │
              │  • Auto-Sync     │  │ • 2FA Handling  │
              └──────────────────┘  └──────────────────┘
                        │                  │
                        └──────────┬───────┘
                                   ▼
                        ┌──────────────────┐
                        │    FACEBOOK      │
                        │   • Groups       │
                        │   • Marketplace  │
                        └──────────────────┘
```

---

## 🔄 Method 1: Facebook Groups (API-Based)

### **How It Works:**

1. Sales rep connects their Facebook account via OAuth
2. Backend retrieves list of Groups they're a member of
3. Sales rep selects target groups (e.g., "Local Auto Deals")
4. Backend posts vehicles to selected groups using Graph API
5. Posts automatically appear in Facebook Marketplace

### **Implementation:**

```typescript
// Facebook Group Posting Flow
POST /api/facebook/groups/connect
  → User authorizes app
  → Get groups: GET /me/groups

POST /api/vehicles/:id/post-to-group
  → Create post in group
  → Graph API: POST /{group-id}/feed
  → Returns post ID

GET /api/facebook/posts
  → View all posted listings
  → Track engagement
```

### **Required Facebook Permissions:**
- `publish_to_groups` - Post to groups
- `groups_access_member_info` - Read group membership
- `user_posts` - Manage user posts

### **Advantages:**
✅ Fully automated - no user interaction needed  
✅ Scheduled posting supported  
✅ Bulk posting capability  
✅ Analytics and tracking  
✅ Post editing/deletion via API  

### **Limitations:**
⚠️ Requires group membership  
⚠️ Group admins must allow posts  
⚠️ May not reach as wide audience as personal Marketplace  

---

## 🤖 Method 2: Personal Marketplace (Chrome Extension)

### **How It Works:**

1. Sales rep stores their Facebook credentials in the system
2. Credentials are encrypted and stored per-user
3. Chrome extension logs in using stored credentials
4. Extension navigates to Facebook Marketplace create page
5. Auto-fills vehicle data (price, description, photos)
6. Handles 2FA using stored backup codes
7. User clicks final "Post" button (to stay TOS-compliant)

### **Data Flow:**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Sales Rep Stores Credentials (One-time setup)           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Dashboard → Settings → Credentials                         │
│                                                             │
│  ┌─────────────────────────────────────┐                  │
│  │ Facebook Username: john@email.com   │                  │
│  │ Password: ••••••••••                │                  │
│  │ 2FA Codes:                          │                  │
│  │   • 12623384                        │                  │
│  │   • 19728744                        │                  │
│  │   • 22097559                        │                  │
│  └─────────────────────────────────────┘                  │
│                   │                                         │
│                   ▼                                         │
│         ┌──────────────────┐                               │
│         │ Encrypted Storage │                               │
│         │   (Database)      │                               │
│         └──────────────────┘                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 2. Chrome Extension Auto-Posts (Triggered by user)         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  User selects vehicle → Click "Post to My Marketplace"     │
│                                                             │
│  ┌──────────────────────────────────────────┐             │
│  │ Chrome Extension Process:                │             │
│  │                                           │             │
│  │ 1. Fetch credentials from backend        │             │
│  │ 2. Navigate to facebook.com/marketplace  │             │
│  │ 3. Auto-login with credentials           │             │
│  │ 4. If 2FA → use backup code              │             │
│  │ 5. Click "Create New Listing"            │             │
│  │ 6. Fill form:                            │             │
│  │    • Title: "2024 Ford F-150..."         │             │
│  │    • Price: $45,000                      │             │
│  │    • Description: Full details           │             │
│  │    • Photos: Upload images               │             │
│  │    • Category: Vehicles                  │             │
│  │    • Location: Auto-filled               │             │
│  │ 7. User clicks "Publish" (final step)    │             │
│  │ 8. Capture post URL                      │             │
│  │ 9. Send confirmation to backend          │             │
│  └──────────────────────────────────────────┘             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### **Chrome Extension Features:**

#### **Credentials Tab**
```javascript
{
  "username": "wgzup13.gz@gmail.com",
  "password": "encrypted_password",
  "twoFactorCodes": [
    "12623384",
    "19728744", 
    "22097559",
    "24139576",
    "35933318"
  ],
  "lastUsedCodeIndex": 2,
  "lastSync": "2026-01-14T10:30:00Z"
}
```

#### **Auto-Post Process**
1. **Authentication**
   - Check if logged into Facebook
   - If not, auto-login with stored credentials
   - Handle 2FA by using next available backup code
   - Mark code as used

2. **Form Filling**
   ```javascript
   // Extension fills Marketplace form
   document.querySelector('[name="title"]').value = vehicle.year + ' ' + vehicle.make + ' ' + vehicle.model;
   document.querySelector('[name="price"]').value = vehicle.price;
   document.querySelector('[name="description"]').value = generateDescription(vehicle);
   // Upload photos from vehicle.imageUrls
   // Set category, location, etc.
   ```

3. **User Confirmation**
   - Extension fills everything
   - Highlights "Publish" button
   - User clicks to post (maintains TOS compliance)
   - Extension captures success/error

4. **Tracking**
   ```javascript
   // Send to backend after successful post
   POST /api/facebook/marketplace/confirm
   {
     "vehicleId": "uuid",
     "postUrl": "https://facebook.com/marketplace/item/...",
     "postedAt": "2026-01-14T10:35:00Z",
     "status": "PUBLISHED"
   }
   ```

### **Advantages:**
✅ Posts to personal Marketplace (wider reach)  
✅ Automated form filling (saves time)  
✅ 2FA handling with backup codes  
✅ Works even if Facebook blocks API  
✅ Each sales rep posts from their own account  

### **Limitations:**
⚠️ Requires Chrome extension installation  
⚠️ Semi-automated (user clicks final button)  
⚠️ Browser must be open  
⚠️ Credentials storage security concerns  

---

## 🔐 Security Architecture

### **Credential Encryption**

```typescript
// Backend: Encrypting Facebook credentials
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.FB_CREDENTIALS_KEY; // 32-byte key
const IV_LENGTH = 16;

function encryptCredential(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decryptCredential(text: string): string {
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift()!, 'hex');
  const encrypted = Buffer.from(parts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}
```

### **Extension Communication**

```typescript
// Chrome Extension → Backend (Secure Channel)
// Extension authenticates with JWT token

// 1. Get credentials
GET /api/users/me/facebook-credentials
Headers: {
  "Authorization": "Bearer <jwt_token>"
}
Response: {
  "username": "decrypted_email",
  "password": "decrypted_password",
  "twoFactorCodes": ["12623384", "19728744"],
  "nextCodeIndex": 0
}

// 2. Mark 2FA code as used
PATCH /api/users/me/facebook-credentials/use-code
{
  "codeIndex": 0
}

// 3. Confirm post success
POST /api/facebook/marketplace/confirm
{
  "vehicleId": "uuid",
  "postUrl": "...",
  "screenshot": "base64_image"
}
```

---

## 📱 Combined Posting Strategy

### **Recommended Workflow:**

**For Maximum Reach:**
1. **Auto-post to Facebook Groups** (API) - Immediate, bulk posting
2. **Sales rep posts to personal Marketplace** (Extension) - Higher visibility

**Daily Routine:**
- Morning: Sync new inventory from FTP
- Auto-post new vehicles to dealer Facebook Groups
- Sales rep reviews vehicles in dashboard
- Click "Post to My Marketplace" for featured vehicles
- Extension handles the rest

**Tracking:**
```sql
-- Track posting performance
SELECT 
  v.vin,
  COUNT(DISTINCT CASE WHEN fp.type = 'GROUP' THEN fp.id END) as group_posts,
  COUNT(DISTINCT CASE WHEN fp.type = 'MARKETPLACE' THEN fp.id END) as marketplace_posts,
  SUM(fp.views) as total_views,
  SUM(fp.leads) as total_leads
FROM vehicles v
LEFT JOIN facebook_posts fp ON v.id = fp.vehicle_id
GROUP BY v.vin;
```

---

## 🎯 Implementation Checklist

### **Backend Updates:**
- [x] Add FB credentials fields to User model
- [ ] Create credentials encryption service
- [ ] Add endpoints: `/api/users/me/facebook-credentials` (CRUD)
- [ ] Add endpoint: `/api/facebook/marketplace/confirm` (post tracking)
- [ ] Update FacebookController for Group posting
- [ ] Add 2FA code rotation logic

### **Chrome Extension:**
- [ ] Create extension manifest v3
- [ ] Build authentication module (JWT storage)
- [ ] Implement Facebook login automation
- [ ] Create 2FA handler (backup code usage)
- [ ] Build Marketplace form filler
- [ ] Add screenshot capture
- [ ] Create post confirmation dialog
- [ ] Build credentials settings UI

### **Dashboard (React):**
- [ ] Add "Credentials" tab in user settings
- [ ] Build Facebook credentials form
- [ ] Add 2FA codes management UI
- [ ] Create "Post to Marketplace" button per vehicle
- [ ] Show posting history/status
- [ ] Display success/error notifications

### **Security:**
- [ ] Generate FB_CREDENTIALS_KEY (32-byte)
- [ ] Implement AES-256 encryption
- [ ] Add HTTPS-only credential transmission
- [ ] Implement rate limiting on credential endpoints
- [ ] Add audit logging for credential access
- [ ] Secure 2FA code rotation

---

## 🚀 Next Steps

1. **Update Prisma schema** (add FB credential fields) ✅
2. **Run migration**: `npx prisma db push`
3. **Build credential encryption service**
4. **Update Facebook controller** (add credential CRUD)
5. **Start Chrome extension** (scaffold with manifest)
6. **Build React dashboard** (credentials UI)
7. **Test end-to-end flow**

---

## 📞 Facebook App Setup (Revised)

### **Required Permissions:**

**For Group Posting (API):**
- `publish_to_groups`
- `groups_access_member_info`
- `user_posts`

**For Extension (No API needed):**
- Chrome extension uses regular browser session
- No Facebook app permissions required
- Works with any personal Facebook account

### **Setup Priority:**
1. **Start with Extension** - No Facebook app approval needed
2. **Add Group API** - Requires Facebook app review
3. **Launch both** - Maximum coverage

---

This hybrid approach gives you:
✅ **API Automation** (Groups) - Set it and forget it  
✅ **Personal Touch** (Marketplace) - Higher engagement  
✅ **Compliance** - Stays within Facebook TOS  
✅ **Flexibility** - Sales reps control their posts  
✅ **Scale** - Handles hundreds of vehicles daily
