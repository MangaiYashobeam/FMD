# Facebook OAuth Setup Guide

This guide walks you through setting up Facebook OAuth integration for FaceMyDealer.

## Prerequisites

- Facebook account (preferably a business account)
- Access to Facebook Developers platform
- FaceMyDealer production environment already deployed

## Step 1: Create a Facebook App

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Click **My Apps** → **Create App**
3. Select **Business** as the app type
4. Fill in the details:
   - **App Name**: `FaceMyDealer` (or your dealership name)
   - **App Contact Email**: Your business email
   - **Business Portfolio**: Select or create one
5. Click **Create App**

## Step 2: Configure Facebook Login

1. In your app dashboard, click **Add Product**
2. Find **Facebook Login** and click **Set Up**
3. Select **Web** as the platform
4. Enter your site URL: `https://fmd-production.up.railway.app`
5. Click **Save** → **Continue**

### Configure OAuth Settings

1. Go to **Facebook Login** → **Settings** in the left sidebar
2. Configure the following:

```
Client OAuth Login: YES
Web OAuth Login: YES
Enforce HTTPS: YES
Valid OAuth Redirect URIs:
  - https://fmd-production.up.railway.app/api/auth/facebook/callback
  - https://fmd-production.up.railway.app/api/facebook/callback
```

3. Click **Save Changes**

## Step 3: Add Required Permissions

1. Go to **App Review** → **Permissions and Features**
2. Request the following permissions:

### Essential Permissions (Required)

| Permission | Description | Review Required |
|------------|-------------|-----------------|
| `public_profile` | Basic profile info | No |
| `email` | User's email address | No |

### Advanced Permissions (For Marketplace Posting)

| Permission | Description | Review Required |
|------------|-------------|-----------------|
| `pages_show_list` | List user's pages | Yes |
| `pages_read_engagement` | Read page engagement | Yes |
| `pages_manage_posts` | Post to pages | Yes |
| `groups_access_member_info` | Access group member info | Yes |
| `publish_to_groups` | Post to groups | Yes |

> **Note**: Advanced permissions require Facebook App Review before production use.

## Step 4: Get App Credentials

1. Go to **Settings** → **Basic**
2. Copy the following:
   - **App ID**: `your-app-id`
   - **App Secret**: Click **Show** to reveal (requires password)

## Step 5: Configure Environment Variables

Add these to your Railway environment variables:

```env
# Facebook OAuth Configuration
FACEBOOK_APP_ID=your-app-id-here
FACEBOOK_APP_SECRET=your-app-secret-here
FACEBOOK_REDIRECT_URI=https://fmd-production.up.railway.app/api/auth/facebook/callback
FACEBOOK_GRAPH_API_VERSION=v18.0
```

### Setting Variables in Railway

1. Go to your Railway project dashboard
2. Click on the **server** service
3. Navigate to **Variables** tab
4. Add each variable with its value
5. Railway will automatically redeploy

## Step 6: Request App Review (For Production)

To use advanced features like posting to Marketplace groups, you need Facebook App Review:

1. Go to **App Review** → **Requests**
2. Click **Start a Submission**
3. For each permission:
   - Provide a detailed description of use case
   - Upload a screencast demonstrating the feature
   - Explain data handling and privacy compliance

### Tips for Approval

- Be specific about how each permission is used
- Show clear UI demonstrating user consent flows
- Emphasize privacy and data protection measures
- Provide business verification documents if requested

## Step 7: Test the Integration

### Development Testing

1. While the app is in **Development Mode**, only app administrators and testers can use it
2. Add test users in **Roles** → **Test Users**

### Test the OAuth Flow

1. Navigate to `https://fmd-production.up.railway.app/facebook`
2. Click **Connect Facebook Account**
3. Complete the OAuth authorization
4. Verify the connection appears in the dashboard

## Troubleshooting

### Common Issues

**Error: App Not Setup**
- Ensure all OAuth redirect URIs are correctly configured
- Check that Facebook Login product is added and configured

**Error: Invalid Redirect URI**
- The redirect URI must exactly match what's configured in Facebook
- Check for trailing slashes and protocol (https)

**Error: Permissions Not Granted**
- User declined one or more permissions
- For advanced permissions, ensure App Review is complete

**Error: Invalid App Secret**
- Double-check the App Secret is copied correctly
- Regenerate if necessary (will invalidate existing tokens)

### Debug Mode

Enable debug logging by setting:
```env
FB_DEBUG=true
LOG_LEVEL=debug
```

## Security Best Practices

1. **Never expose App Secret** in client-side code
2. **Use HTTPS** for all OAuth callbacks
3. **Validate state parameter** to prevent CSRF attacks
4. **Store tokens securely** with encryption at rest
5. **Implement token refresh** to maintain access
6. **Audit access regularly** and revoke unused connections

## API Rate Limits

Facebook Graph API has rate limits:
- **User tokens**: 200 calls/hour per user
- **App tokens**: 200 × number of users/hour
- **Page tokens**: 4800 calls/day per page

FaceMyDealer implements automatic rate limiting and retry logic.

## Support Resources

- [Facebook Developer Documentation](https://developers.facebook.com/docs/)
- [Facebook Login Documentation](https://developers.facebook.com/docs/facebook-login/)
- [Graph API Reference](https://developers.facebook.com/docs/graph-api/)
- [App Review Guidelines](https://developers.facebook.com/docs/app-review/)

---

## Quick Start Checklist

- [ ] Create Facebook Developer App
- [ ] Add Facebook Login product
- [ ] Configure OAuth redirect URIs
- [ ] Get App ID and App Secret
- [ ] Add environment variables to Railway
- [ ] Add test users for development
- [ ] Test OAuth flow
- [ ] Submit for App Review (when ready for production)
