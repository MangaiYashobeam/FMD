# FaceMyDealer - Owner System Management TODO

## 🔐 ROOT ADMIN CREDENTIALS
```
Email:    admin@gadproductions.com
Password: GadAdmin2026!Temp (MUST BE CHANGED ON FIRST LOGIN)
```

**Run this command on Railway to seed the admin user:**
```bash
npm run db:seed:admin
```

---

## ✅ COMPLETED FEATURES (Backend API)

### Authentication & Authorization
- [x] SUPER_ADMIN role in database schema
- [x] Authentication middleware with role detection
- [x] requireSuperAdmin middleware for admin routes
- [x] JWT token with role information

### Admin API Endpoints (/api/admin/*)
- [x] GET /api/admin/accounts - Get all accounts (system-wide)
- [x] POST /api/admin/accounts - Create new account
- [x] PUT /api/admin/accounts/:id/status - Activate/deactivate account
- [x] DELETE /api/admin/accounts/:id - Soft delete account
- [x] GET /api/admin/users - Get all users (system-wide)
- [x] PUT /api/admin/users/:userId/accounts/:accountId/role - Update user role
- [x] GET /api/admin/stats - System statistics
- [x] GET /api/admin/payments - All payments
- [x] GET /api/admin/revenue - Revenue analytics
- [x] GET /api/admin/audit-logs - System audit logs

### Email Management API (/api/email/*)
- [x] GET /api/email/logs - Email logs with filtering
- [x] GET /api/email/stats - Email statistics
- [x] POST /api/email/test - Send test email
- [x] POST /api/email/bulk - Send bulk emails
- [x] POST /api/email/resend/:logId - Resend failed email

### Database Models
- [x] User model with roles
- [x] Account model with subscription info
- [x] AccountUser junction with role assignment
- [x] EmailLog model
- [x] AuditLog model
- [x] Payment model

---

## 📋 TODO - FRONTEND ADMIN PAGES (Priority: HIGH)

### 1. System Dashboard Page (`/admin/`)
- [ ] Total accounts overview card
- [ ] Active vs inactive accounts
- [ ] Total users count
- [ ] Total revenue (MRR, ARR)
- [ ] Revenue chart (last 12 months)
- [ ] Recent signups list
- [ ] System health indicators
- [ ] Quick actions panel

### 2. Accounts Management Page (`/admin/accounts`)
- [ ] Accounts data table with pagination
- [ ] Search/filter by name, status, plan
- [ ] Account details modal/drawer
- [ ] Create new account form
- [ ] Edit account modal
- [ ] Activate/Deactivate toggle
- [ ] Delete account (with confirmation)
- [ ] View account users
- [ ] View account vehicles count
- [ ] View account payment history
- [ ] Account subscription status
- [ ] Trial expiration warnings

### 3. Users Management Page (`/admin/users`)
- [ ] Users data table with pagination
- [ ] Search by email, name
- [ ] Filter by role
- [ ] User details modal
- [ ] Edit user role
- [ ] View user's accounts
- [ ] View user activity/audit trail
- [ ] Reset user password (send email)
- [ ] Deactivate/Reactivate user
- [ ] Impersonate user (login as)

### 4. Payments & Revenue Page (`/admin/payments`)
- [ ] Payments data table
- [ ] Filter by status, date range, plan
- [ ] Revenue summary cards
- [ ] Revenue chart by period (7d, 30d, 90d, 1y)
- [ ] MRR/ARR calculations
- [ ] Payment details modal
- [ ] Failed payments list
- [ ] Refund functionality
- [ ] Export to CSV

### 5. Email Logs Page (`/admin/emails`)
- [ ] Email logs table with pagination
- [ ] Filter by status (sent, failed, pending)
- [ ] Search by recipient
- [ ] Email preview modal
- [ ] Resend failed emails
- [ ] Email statistics dashboard
- [ ] Email templates management
- [ ] Test email sender

### 6. Audit Logs Page (`/admin/audit-logs`)
- [ ] Audit logs table with pagination
- [ ] Filter by action type
- [ ] Filter by user
- [ ] Filter by date range
- [ ] Filter by entity type
- [ ] Log details modal (with metadata)
- [ ] Export audit logs

### 7. System Settings Page (`/admin/settings`)
- [ ] System configuration form
- [ ] Email settings (SMTP)
- [ ] Default trial duration
- [ ] Feature flags
- [ ] API rate limits
- [ ] Maintenance mode toggle
- [ ] System notifications
- [ ] Backup settings

---

## 📋 TODO - BACKEND ENHANCEMENTS (Priority: MEDIUM)

### Admin Controller Additions
- [ ] GET /api/admin/accounts/:id - Get single account details
- [ ] GET /api/admin/accounts/:id/users - Get account users
- [ ] GET /api/admin/accounts/:id/vehicles - Get account vehicles
- [ ] GET /api/admin/accounts/:id/payments - Get account payments
- [ ] POST /api/admin/users/:id/reset-password - Trigger password reset
- [ ] POST /api/admin/users/:id/impersonate - Generate impersonation token
- [ ] GET /api/admin/dashboard - Combined dashboard stats
- [ ] POST /api/admin/system/maintenance - Toggle maintenance mode
- [ ] GET /api/admin/system/config - Get system configuration
- [ ] PUT /api/admin/system/config - Update system configuration

### System Config Model (New)
- [ ] Create SystemConfig model in schema
- [ ] Default trial duration
- [ ] Feature flags JSON
- [ ] Email configuration
- [ ] Rate limit settings
- [ ] Maintenance mode flag

### Reporting & Analytics
- [ ] Churn rate calculation
- [ ] Customer lifetime value (LTV)
- [ ] Conversion rate (trial to paid)
- [ ] Vehicle posting statistics
- [ ] Facebook engagement metrics

---

## 📋 TODO - NOTIFICATIONS & ALERTS (Priority: MEDIUM)

### Admin Notifications
- [ ] New account signup notification
- [ ] Failed payment alert
- [ ] High churn alert
- [ ] Trial expiring accounts list
- [ ] System error alerts
- [ ] Low disk/memory warnings

### Email Templates for Admin
- [ ] Welcome email (with temp password)
- [ ] Password reset email
- [ ] Account activated notification
- [ ] Account suspended notification
- [ ] Payment failed notification
- [ ] Trial ending reminder

---

## 📋 TODO - SECURITY ENHANCEMENTS (Priority: HIGH)

### Authentication
- [ ] Two-factor authentication for SUPER_ADMIN
- [ ] Session management (active sessions list)
- [ ] Force logout all sessions
- [ ] Login attempt monitoring
- [ ] IP whitelist for admin access
- [ ] Password change requirement on first login

### Audit & Compliance
- [ ] Detailed activity logging
- [ ] Data export for compliance
- [ ] GDPR data deletion requests
- [ ] Access control matrix documentation

---

## 📋 TODO - CLIENT PORTAL FEATURES (Priority: LOW)

### Account Owner Features
- [ ] View own account analytics
- [ ] Manage team members
- [ ] View billing history
- [ ] Update payment method
- [ ] Upgrade/downgrade subscription
- [ ] View vehicle posting stats

---

## 📁 FILE STRUCTURE FOR ADMIN PAGES

```
web/src/
├── pages/
│   └── admin/                       # NEW FOLDER
│       ├── AdminDashboardPage.tsx   # System overview
│       ├── AccountsPage.tsx         # Accounts management
│       ├── UsersPage.tsx            # Users management
│       ├── PaymentsPage.tsx         # Payments & revenue
│       ├── EmailLogsPage.tsx        # Email logs
│       ├── AuditLogsPage.tsx        # Audit logs
│       └── SystemSettingsPage.tsx   # System settings
├── components/
│   └── admin/                       # NEW FOLDER
│       ├── AdminLayout.tsx          # Admin sidebar layout
│       ├── StatsCard.tsx            # Dashboard stat card
│       ├── AccountsTable.tsx        # Accounts data table
│       ├── UsersTable.tsx           # Users data table
│       ├── PaymentsTable.tsx        # Payments data table
│       ├── EmailLogsTable.tsx       # Email logs table
│       ├── AuditLogsTable.tsx       # Audit logs table
│       ├── RevenueChart.tsx         # Revenue chart component
│       └── AccountModal.tsx         # Account details modal
└── lib/
    └── adminApi.ts                  # Admin API client (extend existing)
```

---

## 🚀 IMPLEMENTATION PRIORITY ORDER

### Phase 1 - Core Admin Dashboard (Week 1)
1. Admin layout with sidebar
2. Dashboard page with stats
3. Accounts list page
4. Users list page

### Phase 2 - Financial Management (Week 2)
1. Payments page
2. Revenue analytics
3. Subscription management

### Phase 3 - Operations (Week 3)
1. Email logs page
2. Audit logs page
3. System settings page

### Phase 4 - Advanced Features (Week 4)
1. User impersonation
2. Bulk operations
3. Advanced analytics
4. Export functionality

---

## 📝 NOTES

- All admin pages require SUPER_ADMIN role
- Backend API endpoints are already implemented and ready
- Client folder has partial admin service implementation
- Web folder needs new admin pages created
- Use existing components as templates (SettingsPage, TeamPage)
