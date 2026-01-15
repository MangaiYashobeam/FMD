# Email Notification System

Complete email notification system for FaceMyDealer with templates, queue-based delivery, and comprehensive admin controls.

## Features

### 📧 Email Service
- **SMTP Integration**: Support for Gmail, SendGrid, AWS SES, or custom SMTP servers
- **Development Mode**: Automatic test account creation with Ethereal.email for development
- **Template System**: Pre-built HTML/text templates with variable substitution
- **Database Logging**: All emails logged with status tracking
- **Error Handling**: Comprehensive error logging and retry mechanisms

### 🔄 Queue System
- **Reliable Delivery**: BullMQ-powered queue with Redis backend
- **Retry Logic**: 3 automatic retries with exponential backoff (5s → 10s → 20s)
- **Concurrent Processing**: Process 5 emails simultaneously
- **Job Retention**: Keep completed jobs for 24 hours, failed jobs for 7 days
- **Priority Support**: Queue emails with different priority levels

### 📋 Email Templates

#### 1. Welcome Email
**Trigger**: User registration  
**Variables**: userName, userEmail, tempPassword (optional)  
**Content**: Welcome message, login credentials, getting started steps

#### 2. Password Reset
**Trigger**: Password reset request  
**Variables**: userName, resetUrl  
**Content**: Reset link, expiration warning, security notice

#### 3. Sync Completion
**Trigger**: Inventory sync completion  
**Variables**: accountName, imported, updated, failed  
**Content**: Sync results summary, statistics breakdown

#### 4. Payment Receipt
**Trigger**: Successful payment  
**Variables**: accountName, amount, invoiceUrl  
**Content**: Payment confirmation, invoice link, receipt details

#### 5. Payment Failed
**Trigger**: Payment failure  
**Variables**: amount, reason  
**Content**: Failure notification, action steps, payment method update link

#### 6. Daily Digest
**Trigger**: Scheduled daily  
**Variables**: newPosts, totalViews, messages, syncStatus  
**Content**: Activity summary, statistics, dashboard link

## Configuration

### Environment Variables

```env
# SMTP Settings
SMTP_HOST=smtp.gmail.com          # SMTP server hostname
SMTP_PORT=587                     # SMTP port (587 for TLS, 465 for SSL)
SMTP_USER=your-email@gmail.com    # SMTP username
SMTP_PASSWORD=your-app-password   # SMTP password or app-specific password

# Email Settings
EMAIL_FROM=noreply@facemydealer.com  # From email address
EMAIL_FROM_NAME=FaceMyDealer          # From display name
```

### SMTP Provider Examples

#### Gmail
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password  # Use App Password, not account password
```

**Gmail Setup**:
1. Enable 2-Factor Authentication
2. Go to Security → App Passwords
3. Create new app password for "Mail"
4. Use generated password in SMTP_PASSWORD

#### SendGrid
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=YOUR_SENDGRID_API_KEY
```

#### AWS SES
```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=YOUR_SES_SMTP_USERNAME
SMTP_PASSWORD=YOUR_SES_SMTP_PASSWORD
```

#### Mailgun
```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@your-domain.mailgun.org
SMTP_PASSWORD=YOUR_MAILGUN_PASSWORD
```

## API Endpoints

All email endpoints require authentication and admin permissions.

### POST /api/email/test
**Permission**: SUPER_ADMIN or ADMIN  
**Description**: Send test email  
**Request**:
```json
{
  "to": "test@example.com",
  "subject": "Test Email",
  "body": "<h1>Test</h1><p>This is a test email.</p>"
}
```

### GET /api/email/logs
**Permission**: SUPER_ADMIN or ADMIN  
**Description**: Get email logs with pagination  
**Query Parameters**:
- `page` (number, default: 1)
- `limit` (number, default: 50)
- `status` (string, optional): Filter by status (SENT, FAILED, QUEUED, BOUNCED)

**Response**:
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "uuid",
        "recipient": "user@example.com",
        "subject": "Welcome to FaceMyDealer",
        "status": "SENT",
        "messageId": "msg_12345",
        "createdAt": "2025-01-01T12:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 150,
      "pages": 3
    }
  }
}
```

### POST /api/email/resend/:logId
**Permission**: SUPER_ADMIN or ADMIN  
**Description**: Resend a failed email  
**Response**:
```json
{
  "success": true,
  "message": "Email queued for resending"
}
```

### GET /api/email/stats
**Permission**: SUPER_ADMIN or ADMIN  
**Description**: Get email statistics  
**Query Parameters**:
- `period` (string): 7d, 30d, or 90d

**Response**:
```json
{
  "success": true,
  "data": {
    "period": "7d",
    "stats": [
      {
        "status": "SENT",
        "count": 125,
        "date": "2025-01-01"
      }
    ],
    "totals": [
      {
        "status": "SENT",
        "count": 850
      },
      {
        "status": "FAILED",
        "count": 15
      }
    ]
  }
}
```

### POST /api/email/bulk
**Permission**: SUPER_ADMIN only  
**Description**: Send bulk email to multiple recipients  
**Request**:
```json
{
  "recipients": ["user1@example.com", "user2@example.com"],
  "subject": "Important Announcement",
  "body": "<h1>Announcement</h1><p>Message content...</p>",
  "accountId": "account-uuid" (optional)
}
```

### GET /api/email/templates
**Permission**: SUPER_ADMIN or ADMIN  
**Description**: List available email templates  
**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "welcome",
      "name": "Welcome Email",
      "description": "Sent to new users upon registration",
      "variables": ["userName", "userEmail", "tempPassword"]
    }
  ]
}
```

## Usage Examples

### Programmatic Email Sending

```typescript
import { emailService } from '@/services/email.service';

// Send welcome email
await emailService.sendWelcomeEmail(
  'user@example.com',
  'John Doe',
  'temp123' // Optional temporary password
);

// Send password reset
await emailService.sendPasswordResetEmail(
  'user@example.com',
  'reset-token-12345',
  'John Doe'
);

// Send sync completion
await emailService.sendSyncCompletionEmail(
  'user@example.com',
  'Acme Auto Dealers',
  { imported: 25, updated: 10, failed: 2 }
);

// Send payment receipt
await emailService.sendPaymentReceiptEmail(
  'user@example.com',
  699.00,
  'https://invoice.stripe.com/...',
  'Acme Auto Dealers'
);

// Send payment failed notification
await emailService.sendPaymentFailedEmail(
  'user@example.com',
  699.00,
  'Insufficient funds'
);

// Send daily digest
await emailService.sendDailyDigest(
  'user@example.com',
  {
    newPosts: 15,
    totalViews: 1250,
    messages: 8,
    syncStatus: '3 hours ago'
  }
);
```

### Queue-Based Sending

```typescript
import { queueEmail, queueTemplateEmail } from '@/queues/email.queue';

// Queue a direct email
await queueEmail({
  to: 'user@example.com',
  subject: 'Custom Subject',
  html: '<h1>Custom Email</h1>',
  text: 'Custom Email'
}, 1); // Priority: 1 (higher = more urgent)

// Queue a template email
await queueTemplateEmail(
  {
    name: 'custom-template',
    subject: 'Hello {{userName}}',
    html: '<p>Hi {{userName}}, your code is {{code}}</p>'
  },
  'user@example.com',
  { userName: 'John', code: '12345' }
);
```

## Database Schema

### EmailLog Model

```prisma
model EmailLog {
  id            String   @id @default(uuid())
  recipient     String
  subject       String
  status        String   // SENT, FAILED, QUEUED, BOUNCED
  messageId     String?  @map("message_id")
  errorMessage  String?  @map("error_message") @db.Text
  metadata      Json?    // Additional data
  createdAt     DateTime @default(now()) @map("created_at")

  @@index([recipient])
  @@index([status])
  @@index([createdAt])
  @@map("email_logs")
}
```

## Monitoring & Troubleshooting

### Check Email Queue Status

```typescript
import { emailQueue, emailWorker } from '@/queues/email.queue';

// Get queue stats
const jobCounts = await emailQueue.getJobCounts();
console.log(`Waiting: ${jobCounts.waiting}, Active: ${jobCounts.active}, Failed: ${jobCounts.failed}`);

// Get failed jobs
const failed = await emailQueue.getFailed();
console.log('Failed jobs:', failed);

// Retry all failed jobs
for (const job of failed) {
  await job.retry();
}
```

### Development Mode

When `SMTP_PASSWORD` is not configured, the service automatically creates an Ethereal test account. Check logs for preview URLs:

```
📧 Email test account created: user@ethereal.email
📧 Email sent: <msg-id> to recipient@example.com
📧 Preview URL: https://ethereal.email/message/abc123
```

Click the preview URL to see the email in Ethereal's web interface.

### Common Issues

#### Emails Not Sending

1. **Check SMTP credentials**: Verify environment variables
2. **Check email queue**: Look for failed jobs in Redis
3. **Check email logs**: Query database for error messages
4. **Test SMTP connection**: Use test endpoint

#### Gmail "Less Secure Apps" Error

Gmail requires App Passwords when 2FA is enabled:
1. Enable 2-Factor Authentication
2. Generate App Password
3. Use App Password (not account password) in SMTP_PASSWORD

#### Rate Limiting

Email providers have rate limits:
- **Gmail**: 500 emails/day for free accounts
- **SendGrid**: 100 emails/day for free tier
- **AWS SES**: 200 emails/day in sandbox mode

Monitor queue size and adjust concurrent processing if needed.

## Best Practices

### 1. Use Queue for All Emails
Always queue emails rather than sending directly to avoid blocking requests:

```typescript
// ❌ Bad: Blocks request
await emailService.sendEmail(options);

// ✅ Good: Non-blocking
await queueEmail(options);
```

### 2. Handle Errors Gracefully
Don't throw errors for email failures:

```typescript
// Send email but don't fail the request
emailService.sendWelcomeEmail(user.email, user.name)
  .catch(err => logger.error('Welcome email failed:', err));
```

### 3. Use Templates
Create consistent, branded emails with templates instead of inline HTML.

### 4. Monitor Email Logs
Regularly check failed emails and retry:

```sql
SELECT * FROM email_logs WHERE status = 'FAILED' ORDER BY created_at DESC LIMIT 10;
```

### 5. Test in Development
Use Ethereal in development to avoid sending real emails during testing.

## Future Enhancements

- [ ] Email template editor in admin dashboard
- [ ] Scheduled email campaigns
- [ ] Email analytics (open rates, click rates)
- [ ] Unsubscribe management
- [ ] Email preferences per user
- [ ] Attachment support for invoices
- [ ] Multi-language templates
- [ ] A/B testing for email templates
- [ ] Webhook notifications for email events

## Related Documentation

- [RBAC System](./RBAC_SYSTEM.md) - Role-based access control for email endpoints
- [Stripe Integration](./STRIPE_INTEGRATION.md) - Payment notification emails
- [Deployment Guide](./DEPLOYMENT_GUIDE.md) - Email environment setup in production
