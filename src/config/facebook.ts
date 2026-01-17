/**
 * Facebook Configuration
 * App: DF-Auto Sim
 */

export const FACEBOOK_CONFIG = {
  // Your Facebook App credentials
  appId: '505778791605869',
  appSecret: process.env.FACEBOOK_APP_SECRET || '',
  
  // OAuth settings
  oauth: {
    redirectUri: process.env.NODE_ENV === 'production'
      ? 'https://dealersface.com/api/auth/facebook/callback'
      : 'http://localhost:5000/api/auth/facebook/callback',
    scope: ['email', 'public_profile'],
    graphVersion: 'v18.0',
  },
  
  // Pixel tracking
  pixel: {
    id: '505778791605869',
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
