# 🔐 OAuth Removal & Session-Based Architecture TODO

## Strategic Overview

**Goal**: Remove Facebook OAuth dependency entirely. Implement secure session-based authentication with 2FA TOTP for automatic session recovery.

**Why**: 
- Facebook Marketplace has NO public API for posting
- OAuth was never going to work for Marketplace
- Session-based is the ONLY method that actually works
- Removes Facebook App review risk entirely
- Makes Nova/IAI indistinguishable from human users

---

## Phase 1: Database Schema Updates

### 1.1 New Tables for Session Management

- [ ] **Create `fb_sessions` table**
  ```prisma
  model FbSession {
    id              String   @id @default(cuid())
    accountId       String
    fbUserId        String?           // Facebook user ID (from cookie)
    fbUserName      String?           // Display name
    cookies         String   @db.Text  // Encrypted JSON
    localStorage    String?  @db.Text  // Encrypted JSON (optional)
    encryptionSalt  String            // Per-session salt
    sessionStatus   SessionStatus @default(ACTIVE)
    capturedAt      DateTime @default(now())
    expiresAt       DateTime?         // Estimated expiry
    lastValidatedAt DateTime?         // Last successful use
    lastSyncedAt    DateTime?         // Last sync to server
    source          SessionSource @default(EXTENSION)
    userAgent       String?
    ipAddress       String?
    createdAt       DateTime @default(now())
    updatedAt       DateTime @updatedAt
    
    account         Account  @relation(fields: [accountId], references: [id])
    @@unique([accountId, fbUserId])
    @@index([accountId])
    @@index([sessionStatus])
  }
  
  enum SessionStatus {
    ACTIVE
    EXPIRED
    INVALID
    SYNCING
  }
  
  enum SessionSource {
    EXTENSION       // Captured from desktop Chrome
    SERVER          // Created by Nova on server
    MANUAL          // Manual import
  }
  ```

- [ ] **Create `fb_totp_secrets` table**
  ```prisma
  model FbTotpSecret {
    id              String   @id @default(cuid())
    accountId       String   @unique
    fbUserId        String
    encryptedSecret String   @db.Text  // AES-256 encrypted TOTP secret
    encryptionSalt  String            // Per-secret salt
    isVerified      Boolean  @default(false)
    lastUsedAt      DateTime?
    failedAttempts  Int      @default(0)
    createdAt       DateTime @default(now())
    updatedAt       DateTime @updatedAt
    
    account         Account  @relation(fields: [accountId], references: [id])
  }
  ```

- [ ] **Create `session_sync_log` table**
  ```prisma
  model SessionSyncLog {
    id            String   @id @default(cuid())
    sessionId     String
    direction     SyncDirection
    status        SyncStatus
    sourceDevice  String?          // Browser ID or worker ID
    targetDevice  String?
    errorMessage  String?
    syncedAt      DateTime @default(now())
    
    session       FbSession @relation(fields: [sessionId], references: [id])
    @@index([sessionId])
  }
  
  enum SyncDirection {
    EXTENSION_TO_SERVER
    SERVER_TO_EXTENSION
  }
  
  enum SyncStatus {
    SUCCESS
    FAILED
    PARTIAL
  }
  ```

### 1.2 Deprecate Old OAuth Tables

- [ ] Mark `fb_accounts` table as deprecated (keep for migration)
- [ ] Create migration script to move valid sessions
- [ ] Add `isLegacyOAuth` flag to identify old records

---

## Phase 2: Backend API Changes

### 2.1 New Session Endpoints

- [ ] **POST `/api/extension/session/capture`**
  - Receives cookies from extension
  - Encrypts with AES-256 (per-session salt)
  - Validates cookies are for facebook.com
  - Extracts FB user ID from `c_user` cookie
  - Stores in `fb_sessions` table
  - Returns session ID and status

- [ ] **POST `/api/extension/session/sync`**
  - Syncs session from desktop to server
  - Validates session is still active
  - Updates `lastSyncedAt` timestamp
  - Triggers Nova session import if enabled

- [ ] **GET `/api/extension/session/status/:accountId`**
  - Returns current session status
  - Includes expiry estimate
  - Shows last validation time
  - Indicates if 2FA is configured

- [ ] **POST `/api/extension/session/validate`**
  - Tests if session is still valid
  - Attempts lightweight FB request
  - Updates session status
  - Returns validity + recommendations

- [ ] **DELETE `/api/extension/session/:sessionId`**
  - Revokes session
  - Clears encrypted data
  - Logs security event

### 2.2 2FA TOTP Endpoints

- [ ] **POST `/api/extension/totp/setup`**
  - Generates new TOTP secret (or accepts user's)
  - Returns QR code for FB authenticator setup
  - Encrypts secret with AES-256
  - Stores in `fb_totp_secrets`

- [ ] **POST `/api/extension/totp/verify`**
  - User provides current TOTP code
  - Validates against stored secret
  - Marks `isVerified = true`
  - Returns success status

- [ ] **POST `/api/extension/totp/recover`**
  - Used by Nova when session expires
  - Generates TOTP code from secret
  - Returns code for auto-login
  - Logs recovery attempt

- [ ] **DELETE `/api/extension/totp/:accountId`**
  - Removes TOTP secret
  - Requires re-authentication
  - Logs security event

### 2.3 Remove/Deprecate OAuth Endpoints

- [ ] **Deprecate** `/api/auth/facebook/*` routes
- [ ] **Deprecate** `/api/facebook/connect`
- [ ] **Deprecate** `/api/facebook/callback`
- [ ] Keep endpoints but return `410 Gone` with migration message
- [ ] Log any calls for monitoring

### 2.4 Session Security Service

- [ ] **Create `src/services/session-security.service.ts`**
  ```typescript
  class SessionSecurityService {
    // Encryption
    async encryptSession(cookies: Cookie[], salt: string): Promise<string>
    async decryptSession(encrypted: string, salt: string): Promise<Cookie[]>
    
    // Validation
    async validateSession(sessionId: string): Promise<ValidationResult>
    async validateCookies(cookies: Cookie[]): Promise<boolean>
    
    // TOTP
    async generateTotpSecret(): Promise<{ secret: string, qrCode: string }>
    async encryptTotpSecret(secret: string, salt: string): Promise<string>
    async decryptTotpSecret(encrypted: string, salt: string): Promise<string>
    async generateTotpCode(accountId: string): Promise<string>
    async verifyTotpCode(accountId: string, code: string): Promise<boolean>
    
    // Security events
    async logSecurityEvent(type: string, details: object): Promise<void>
  }
  ```

---

## Phase 3: Extension Changes

### 3.1 Remove OAuth Code

- [ ] Remove `initiateOAuth()` function from `background-ai.js`
- [ ] Remove `exchangeCodeForToken()` function
- [ ] Remove `refreshAccessToken()` function (OAuth version)
- [ ] Remove Facebook App ID configuration
- [ ] Remove OAuth redirect URI handling
- [ ] Update error messages to reflect new flow

### 3.2 Add Session Capture

- [ ] **Create `captureSession()` function**
  ```javascript
  async function captureSession() {
    // Get all Facebook cookies
    const cookies = await chrome.cookies.getAll({ domain: '.facebook.com' });
    
    // Validate required cookies exist
    const required = ['c_user', 'xs', 'datr'];
    const hasRequired = required.every(name => 
      cookies.some(c => c.name === name)
    );
    
    if (!hasRequired) {
      throw new Error('Not logged into Facebook');
    }
    
    // Extract user info
    const cUser = cookies.find(c => c.name === 'c_user');
    const fbUserId = cUser?.value;
    
    // Send to server
    return await fetch(`${API_URL}/extension/session/capture`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ cookies, fbUserId })
    });
  }
  ```

- [ ] **Add session detection listener**
  ```javascript
  // Watch for Facebook login
  chrome.cookies.onChanged.addListener(async (changeInfo) => {
    if (changeInfo.cookie.domain.includes('facebook.com') &&
        changeInfo.cookie.name === 'c_user' &&
        !changeInfo.removed) {
      // User just logged in
      await notifySessionAvailable();
    }
  });
  ```

- [ ] **Add session refresh on activity**
  ```javascript
  // Periodically sync session while user is active on FB
  setInterval(async () => {
    const tabs = await chrome.tabs.query({ url: '*://*.facebook.com/*' });
    if (tabs.length > 0 && authState.isAuthenticated) {
      await syncSessionToServer();
    }
  }, 4 * 60 * 60 * 1000); // Every 4 hours
  ```

### 3.3 Update Sidepanel UI

- [ ] **Replace OAuth login button with session capture flow**
  - Remove "Login with Facebook" OAuth button
  - Add "Connect Facebook Account" that opens facebook.com
  - Add "Capture Session" button when logged in
  - Show session status indicator

- [ ] **Add Session Settings panel**
  ```html
  <div id="session-settings" class="panel">
    <h3>Facebook Session</h3>
    
    <div class="session-status">
      <span class="status-indicator"></span>
      <span class="status-text">Active</span>
      <span class="expiry">Expires in ~27 days</span>
    </div>
    
    <div class="session-options">
      <label>
        <input type="radio" name="recovery" value="manual">
        Manual re-login when expired
      </label>
      <label>
        <input type="radio" name="recovery" value="2fa">
        Auto-recovery with 2FA (recommended)
      </label>
    </div>
    
    <button id="sync-session">Sync to Server</button>
    <button id="setup-2fa">Setup 2FA Recovery</button>
  </div>
  ```

- [ ] **Add 2FA Setup wizard**
  - Step 1: Explain what 2FA recovery does
  - Step 2: Choose generate new or enter existing secret
  - Step 3: Verify with current TOTP code
  - Step 4: Confirm and save

### 3.4 Update Background Worker

- [ ] Update `startIAITaskPolling()` to use session-based auth
- [ ] Update `sendIAIHeartbeat()` to include session status
- [ ] Add session validation before task execution
- [ ] Add automatic session refresh attempt on 401

---

## Phase 4: Python Worker Changes

### 4.1 Session Import from API

- [ ] **Update `SessionManager` to fetch from API**
  ```python
  async def load_session_from_api(self, account_id: str) -> Optional[Dict]:
      """Load session synced from desktop extension"""
      response = await self.http.get(
          f"{self.api_url}/extension/session/export/{account_id}",
          headers={"Authorization": f"Bearer {self.api_token}"}
      )
      if response.status_code == 200:
          return response.json()['storageState']
      return None
  ```

- [ ] **Add session sync check before browser launch**
  ```python
  async def get_browser(self, account_id: str) -> BrowserInstance:
      # Check for fresh session from extension
      api_session = await self.load_session_from_api(account_id)
      local_session = await self.load_session(account_id)
      
      # Use newer session
      if api_session and (not local_session or 
          api_session['synced_at'] > local_session['saved_at']):
          session = api_session
      else:
          session = local_session
      
      # Create browser with session
      return await self._create_browser(account_id, session)
  ```

### 4.2 2FA Auto-Recovery

- [ ] **Create `TotpRecoveryService`**
  ```python
  class TotpRecoveryService:
      async def recover_session(self, account_id: str, page: Page) -> bool:
          """Auto-login using stored TOTP when session expires"""
          
          # Check if we're on login page
          if not self._is_login_page(page):
              return True  # Already logged in
          
          # Get TOTP code from API
          code = await self._get_totp_code(account_id)
          if not code:
              return False
          
          # Fill 2FA form
          await page.fill('input[name="approvals_code"]', code)
          await page.click('button[type="submit"]')
          
          # Wait and verify
          await page.wait_for_navigation()
          return self._is_logged_in(page)
  ```

- [ ] **Integrate with NovaController**
  ```python
  async def ensure_logged_in(self) -> bool:
      """Ensure browser is logged into Facebook"""
      if await self._check_login_status():
          return True
      
      # Try TOTP recovery
      if await self.totp_service.recover_session(
          self.account_id, self.page
      ):
          # Save new session
          await self.session_manager.save_from_browser(
              self.account_id, self.context
          )
          return True
      
      # Notify that manual login is required
      await self._request_manual_login()
      return False
  ```

### 4.3 Session Health Monitoring

- [ ] **Add session validation task**
  ```python
  async def validate_session_health(self, account_id: str) -> SessionHealth:
      """Periodic session health check"""
      browser = await self.pool.get_browser(account_id)
      
      try:
          # Navigate to FB and check login status
          await browser.page.goto('https://www.facebook.com')
          await browser.page.wait_for_load_state('networkidle')
          
          is_logged_in = await self._check_login_status(browser.page)
          
          return SessionHealth(
              account_id=account_id,
              is_valid=is_logged_in,
              checked_at=datetime.utcnow()
          )
      finally:
          await self.pool.release_browser(browser)
  ```

---

## Phase 5: Dashboard/UI Updates

### 5.1 Admin Dashboard Changes

- [ ] **Replace "Facebook OAuth" section with "Facebook Sessions"**
  - Remove OAuth configuration fields
  - Show session status per account
  - Show last sync time
  - Show 2FA status

- [ ] **Update `ExtensionConfigPage.tsx`**
  - Remove Facebook App ID/Secret fields
  - Add session management section
  - Add 2FA configuration options
  - Add session sync controls

- [ ] **Create `SessionManagementCard.tsx`**
  ```tsx
  const SessionManagementCard = ({ accountId }) => {
    const { session, loading } = useSession(accountId);
    
    return (
      <Card>
        <CardHeader>
          <Title>Facebook Session</Title>
          <StatusBadge status={session.status} />
        </CardHeader>
        
        <CardContent>
          <SessionInfo>
            <Label>Account:</Label>
            <Value>{session.fbUserName}</Value>
          </SessionInfo>
          
          <SessionInfo>
            <Label>Status:</Label>
            <Value>{session.status}</Value>
          </SessionInfo>
          
          <SessionInfo>
            <Label>Expires:</Label>
            <Value>{formatDate(session.expiresAt)}</Value>
          </SessionInfo>
          
          <SessionInfo>
            <Label>Last Synced:</Label>
            <Value>{formatDate(session.lastSyncedAt)}</Value>
          </SessionInfo>
          
          <SessionInfo>
            <Label>2FA Recovery:</Label>
            <Value>{session.has2fa ? '✅ Enabled' : '❌ Disabled'}</Value>
          </SessionInfo>
        </CardContent>
        
        <CardActions>
          <Button onClick={validateSession}>Validate</Button>
          <Button onClick={requestSync}>Request Sync</Button>
          {!session.has2fa && (
            <Button onClick={setup2fa}>Setup 2FA</Button>
          )}
        </CardActions>
      </Card>
    );
  };
  ```

### 5.2 Root Dashboard Updates

- [ ] **Update system status to show session health**
  - Replace "OAuth Status" with "Session Status"
  - Show active sessions count
  - Show sessions needing attention
  - Show 2FA coverage percentage

- [ ] **Add Session Overview widget**
  ```tsx
  <SessionOverview>
    <Stat label="Active Sessions" value={stats.activeSessions} />
    <Stat label="Expiring Soon" value={stats.expiringSoon} />
    <Stat label="2FA Enabled" value={`${stats.with2fa}%`} />
    <Stat label="Last Sync" value={stats.lastSync} />
  </SessionOverview>
  ```

### 5.3 User Dashboard Updates

- [ ] **Replace Facebook connection UI**
  - Remove "Connect with Facebook" OAuth button
  - Add "Session Status" card
  - Add "Open Extension" prompt if not installed
  - Show session health and recommendations

- [ ] **Add Session Settings page**
  ```tsx
  <SessionSettingsPage>
    <SessionStatusCard />
    <TwoFactorSetupCard />
    <SyncPreferencesCard />
    <SessionHistoryCard />
  </SessionSettingsPage>
  ```

### 5.4 IAI Command Center Updates

- [ ] **Update soldier status to show session info**
  - Add session status indicator
  - Show 2FA status
  - Add "Session Expired" alert state

- [ ] **Add session-related commands**
  - "Validate Session"
  - "Request Session Sync"
  - "Trigger 2FA Recovery"

---

## Phase 6: Security Implementation

### 6.1 Encryption Standards

- [ ] **Use AES-256-GCM for all encryption**
  - Per-record random salt (16 bytes)
  - PBKDF2 key derivation (100k+ iterations)
  - Integrity verification (GCM auth tag)

- [ ] **Implement `CryptoService`**
  ```typescript
  class CryptoService {
    private readonly algorithm = 'aes-256-gcm';
    private readonly keyLength = 32;
    private readonly saltLength = 16;
    private readonly ivLength = 16;
    private readonly iterations = 100000;
    
    async encrypt(plaintext: string, masterKey: string): Promise<EncryptedData> {
      const salt = crypto.randomBytes(this.saltLength);
      const iv = crypto.randomBytes(this.ivLength);
      const key = await this.deriveKey(masterKey, salt);
      
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);
      let encrypted = cipher.update(plaintext, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      const authTag = cipher.getAuthTag();
      
      return {
        encrypted,
        salt: salt.toString('base64'),
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64')
      };
    }
    
    async decrypt(data: EncryptedData, masterKey: string): Promise<string> {
      // ... decryption implementation
    }
  }
  ```

### 6.2 Access Control

- [ ] **Ensure sessions are account-scoped**
  - User can only access their own sessions
  - Admin can view status but not decrypt
  - Root can manage all sessions

- [ ] **Add session access audit logging**
  - Log every session read/write
  - Log every TOTP generation
  - Log every sync operation

### 6.3 Rate Limiting

- [ ] **Session endpoints rate limits**
  - `/session/capture`: 10/hour per account
  - `/session/sync`: 20/hour per account
  - `/totp/recover`: 5/hour per account (prevent brute force)

### 6.4 Security Events

- [ ] **Define security event types**
  ```typescript
  enum SessionSecurityEvent {
    SESSION_CAPTURED = 'session_captured',
    SESSION_SYNCED = 'session_synced',
    SESSION_EXPIRED = 'session_expired',
    SESSION_REVOKED = 'session_revoked',
    TOTP_SETUP = 'totp_setup',
    TOTP_VERIFIED = 'totp_verified',
    TOTP_RECOVERY_USED = 'totp_recovery_used',
    TOTP_RECOVERY_FAILED = 'totp_recovery_failed',
    SUSPICIOUS_ACTIVITY = 'suspicious_activity'
  }
  ```

---

## Phase 7: Testing Requirements

### 7.1 Unit Tests

- [ ] Test session encryption/decryption
- [ ] Test TOTP generation/verification
- [ ] Test cookie validation
- [ ] Test session expiry detection

### 7.2 Integration Tests

- [ ] Test session capture flow (extension → API)
- [ ] Test session sync flow (API → Python worker)
- [ ] Test 2FA recovery flow
- [ ] Test session validation

### 7.3 End-to-End Tests

- [ ] Test full user onboarding (no OAuth)
- [ ] Test session expiry + manual re-login
- [ ] Test session expiry + 2FA recovery
- [ ] Test desktop + server mirror operation

### 7.4 Security Tests

- [ ] Penetration test session endpoints
- [ ] Test encryption key rotation
- [ ] Test session hijacking prevention
- [ ] Test TOTP brute force protection

---

## Phase 8: Migration & Cleanup

### 8.1 Data Migration

- [ ] Migrate existing OAuth sessions to new format
- [ ] Convert OAuth tokens to session-based where possible
- [ ] Preserve historical data for analytics

### 8.2 Code Cleanup

- [ ] Remove deprecated OAuth imports
- [ ] Remove Facebook App ID from environment
- [ ] Remove OAuth-related error handling
- [ ] Update all documentation

### 8.3 Documentation

- [ ] Update README with new flow
- [ ] Update user guides
- [ ] Update API documentation
- [ ] Create migration guide for existing users

---

## Implementation Order

1. **Database schema** (Phase 1) - Foundation
2. **Backend API** (Phase 2) - Core functionality
3. **Security service** (Phase 6.1-6.2) - Must be secure first
4. **Extension changes** (Phase 3) - User-facing capture
5. **Python workers** (Phase 4) - Server-side consumption
6. **Dashboard updates** (Phase 5) - Visibility
7. **Testing** (Phase 7) - Validation
8. **Migration** (Phase 8) - Cleanup

---

## Success Criteria

- [ ] Zero OAuth calls to Facebook
- [ ] Session capture works reliably
- [ ] 2FA recovery works unattended
- [ ] Sessions sync between desktop and server
- [ ] All dashboards reflect new system
- [ ] Security audit passed
- [ ] All tests passing
- [ ] Documentation complete
