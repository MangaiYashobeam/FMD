# Session-Based Authentication Migration Guide

## Overview

This document describes the migration from OAuth-based Facebook authentication to session-based authentication with TOTP 2FA recovery.

## Why This Change?

**Facebook does NOT have a public Marketplace API.**

OAuth tokens obtained via Facebook Login can only be used to:
- Read user profile data
- Post to Facebook Pages
- Access Graph API endpoints

**OAuth tokens CANNOT:**
- Post to Facebook Marketplace
- Create vehicle listings
- Access Marketplace features

### The Solution: Session-Based Authentication

Instead of OAuth tokens, we now use:
1. **Browser Session Cookies** - Captured from the user's logged-in Facebook session
2. **TOTP 2FA** - For automatic session recovery when Facebook requires verification

## Database Migration

### New Tables

Run the following SQL to create the new session tables:

```sql
-- Enums
CREATE TYPE "FbSessionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'INVALID', 'PENDING_2FA');
CREATE TYPE "FbSessionSource" AS ENUM ('EXTENSION', 'MANUAL', 'RECOVERY');
CREATE TYPE "FbSyncDirection" AS ENUM ('EXTENSION_TO_SERVER', 'SERVER_TO_WORKER', 'WORKER_TO_SERVER', 'EXTENSION_TO_WORKER');
CREATE TYPE "FbSyncStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'PARTIAL');

-- FbSession table (stores encrypted session cookies)
CREATE TABLE "fb_sessions" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "facebook_user_id" TEXT NOT NULL,
    "facebook_user_name" TEXT,
    "encrypted_cookies" TEXT NOT NULL,
    "cookie_hash" TEXT NOT NULL,
    "status" "FbSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "source" "FbSessionSource" NOT NULL DEFAULT 'EXTENSION',
    "last_validated_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "user_agent" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fb_sessions_pkey" PRIMARY KEY ("id")
);

-- FbTotpSecret table (stores encrypted TOTP secrets for 2FA recovery)
CREATE TABLE "fb_totp_secrets" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "encrypted_secret" TEXT NOT NULL,
    "encrypted_backup_codes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "last_used_at" TIMESTAMP(3),
    "fail_count" INTEGER NOT NULL DEFAULT 0,
    "recovery_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fb_totp_secrets_pkey" PRIMARY KEY ("id")
);

-- FbSessionSyncLog table (tracks sync events)
CREATE TABLE "fb_session_sync_logs" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "direction" "FbSyncDirection" NOT NULL,
    "status" "FbSyncStatus" NOT NULL,
    "source_identifier" TEXT,
    "target_identifier" TEXT,
    "cookie_count" INTEGER,
    "sync_duration_ms" INTEGER,
    "error_message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fb_session_sync_logs_pkey" PRIMARY KEY ("id")
);

-- FbRecoveryLog table (tracks 2FA recovery attempts)
CREATE TABLE "fb_recovery_logs" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "session_id" TEXT,
    "recovery_type" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "error_message" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fb_recovery_logs_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "fb_sessions_account_id_facebook_user_id_key" ON "fb_sessions"("account_id", "facebook_user_id");
CREATE INDEX "fb_sessions_account_id_status_idx" ON "fb_sessions"("account_id", "status");
CREATE INDEX "fb_sessions_expires_at_idx" ON "fb_sessions"("expires_at");
CREATE UNIQUE INDEX "fb_totp_secrets_account_id_key" ON "fb_totp_secrets"("account_id");
CREATE INDEX "fb_session_sync_logs_session_id_idx" ON "fb_session_sync_logs"("session_id");
CREATE INDEX "fb_session_sync_logs_created_at_idx" ON "fb_session_sync_logs"("created_at");
CREATE INDEX "fb_recovery_logs_account_id_idx" ON "fb_recovery_logs"("account_id");
CREATE INDEX "fb_recovery_logs_created_at_idx" ON "fb_recovery_logs"("created_at");

-- Foreign Keys
ALTER TABLE "fb_sessions" ADD CONSTRAINT "fb_sessions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fb_totp_secrets" ADD CONSTRAINT "fb_totp_secrets_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fb_session_sync_logs" ADD CONSTRAINT "fb_session_sync_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "fb_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fb_recovery_logs" ADD CONSTRAINT "fb_recovery_logs_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fb_recovery_logs" ADD CONSTRAINT "fb_recovery_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "fb_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

### Alternative: Prisma Migration

If you have local database access, run:
```bash
npx prisma migrate dev --name session_based_auth
```

For production, run:
```bash
npx prisma migrate deploy
```

## Environment Variables

Add the following to your `.env` file:

```env
# Session encryption key (32 bytes, base64 encoded)
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
SESSION_ENCRYPTION_KEY=your-32-byte-key-here
```

## API Endpoints

### Session Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/fb-session/capture` | POST | Capture session from extension |
| `/api/fb-session/sync` | POST | Sync session between systems |
| `/api/fb-session/status/:accountId` | GET | Get session status |
| `/api/fb-session/validate` | POST | Validate a session |
| `/api/fb-session/:sessionId` | DELETE | Delete a session |

### TOTP 2FA

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/fb-session/totp/setup` | POST | Setup 2FA for account |
| `/api/fb-session/totp/verify` | POST | Verify 2FA code |
| `/api/fb-session/totp/:accountId` | DELETE | Disable 2FA |
| `/api/fb-session/totp/generate/:accountId` | GET | Generate recovery code (internal) |

## User Flow

### Initial Setup

1. User installs Chrome extension
2. User logs into Facebook in Chrome
3. User clicks "Capture Session" in extension
4. Extension captures cookies and sends to server
5. Server encrypts and stores session

### With 2FA (Recommended)

1. User sets up 2FA in Settings > Facebook Settings
2. User scans QR code with authenticator app
3. User enters verification code
4. System stores encrypted TOTP secret

### Posting Vehicles

1. User selects vehicle to post
2. System checks for active session
3. If no session, prompts user to capture one
4. If session exists, queues posting task
5. IAI/Soldier uses session to post to Marketplace

### Session Recovery (with 2FA)

1. Facebook requests 2FA verification
2. System generates TOTP code automatically
3. Session is recovered without user intervention

## Deprecated Routes

The following OAuth routes now return deprecation warnings:

- `GET /api/auth/facebook/config` - Returns deprecation notice
- `POST /api/auth/facebook/callback` - Returns HTTP 410 Gone
- `POST /api/auth/facebook/refresh` - Returns HTTP 410 Gone
- `POST /api/auth/facebook/disconnect` - Returns HTTP 410 Gone

## Frontend Changes

### FacebookSettingsPage

- Replaced credential form with session management UI
- Added session status display
- Added 2FA setup wizard
- Removed email/password fields

### SessionManagementCard (Admin)

- New component for admin dashboard
- Shows all account sessions
- Allows validation and deletion
- TOTP status display

## Security Considerations

### Encryption

- Session cookies encrypted with AES-256-GCM
- TOTP secrets encrypted with AES-256-GCM
- Per-record random salt and IV
- PBKDF2 key derivation (100,000 iterations)

### Access Control

- Session routes require authentication
- Account-level access verification
- Internal routes use API key authentication

### Audit Logging

- All session operations logged
- Recovery attempts tracked
- Sync events recorded

## Rollback Plan

If issues arise, the old OAuth system can be re-enabled:

1. Revert `facebook-auth.routes.ts` to non-deprecated version
2. Revert `FacebookSettingsPage.tsx` to credential-based UI
3. Remove new tables if needed

However, OAuth still won't work for Marketplace posting - this is a Facebook limitation, not our code.

## Testing

### Unit Tests

```typescript
// Test session encryption
const encrypted = sessionSecurityService.encryptSession(cookies);
const decrypted = sessionSecurityService.decryptSession(encrypted);
expect(decrypted).toEqual(cookies);

// Test TOTP generation
const code = await sessionSecurityService.generateTotpCode(accountId);
expect(code).toMatch(/^\d{6}$/);
```

### Integration Tests

1. Capture session via extension
2. Verify session stored encrypted
3. Validate session works
4. Setup 2FA
5. Verify 2FA code
6. Test session recovery

## Support

For issues with this migration, contact the development team or create an issue in the repository.
