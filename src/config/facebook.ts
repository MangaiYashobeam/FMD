/**
 * Facebook Configuration
 * App: DF-Auto Sim (Web) / DF-ext-IAI (Extension)
 * 
 * All App IDs and secrets are loaded from environment variables
 * to support different apps for web vs extension flows.
 */

export const FACEBOOK_CONFIG = {
  // Facebook App credentials - loaded from environment
  appId: process.env.FACEBOOK_APP_ID || '',
  appSecret: process.env.FACEBOOK_APP_SECRET || '',
  
  // Extension-specific app (separate Facebook app for Chrome extension OAuth)
  extensionAppId: process.env.FACEBOOK_EXTENSION_APP_ID || '',
  extensionAppSecret: process.env.FACEBOOK_EXTENSION_APP_SECRET || '',
  
  // OAuth settings
  oauth: {
    redirectUri: process.env.FACEBOOK_REDIRECT_URI || (
      process.env.NODE_ENV === 'production'
        ? 'https://dealersface.com/api/auth/facebook/callback'
        : 'http://localhost:5000/api/auth/facebook/callback'
    ),
    scope: ['email', 'public_profile'],
    graphVersion: 'v18.0',
  },
  
  // Pixel tracking
  pixel: {
    id: process.env.FACEBOOK_PIXEL_ID || process.env.FACEBOOK_APP_ID || '',
    events: {
      LEAD_CAPTURED: 'Lead',
      VEHICLE_VIEWED: 'ViewContent',
      VEHICLE_POSTED: 'Purchase',
      MESSAGE_SENT: 'Contact',
      ACCOUNT_CREATED: 'CompleteRegistration',
    },
  },
  
  // API endpoints
  api: {
    baseUrl: 'https://graph.facebook.com',
    authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
  },
  
  // Chrome Extension settings
  extension: {
    id: process.env.CHROME_EXTENSION_ID || '',
    allowedOrigins: [
      'https://www.facebook.com',
      'https://m.facebook.com',
      'https://web.facebook.com',
    ],
  },
};

export default FACEBOOK_CONFIG;
