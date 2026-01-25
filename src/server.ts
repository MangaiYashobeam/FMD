import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables first
dotenv.config();

// Early logging to track startup progress
console.log('🔵 Starting Dealers Face server...');
console.log('🔵 Environment:', process.env.NODE_ENV);
console.log('🔵 Port:', process.env.PORT || 3000);
console.log('🔵 Loading modules...');

import { errorHandler } from '@/middleware/errorHandler';
import { 
  securityHeaders, 
  sanitizeRequest, 
  injectionGuard, 
  ipFilter,
  suspiciousActivityTracker,
  generalLimiter,
  authLimiter,
  passwordResetLimiter,
} from '@/middleware/security';
import {
  csrfTokenProvider,
  csrfProtection,
  attachSecurityContext,
} from '@/middleware/security.middleware';
import {
  createSecureGateway,
  ring5AuthBarrier,
} from '@/middleware/apiGateway';
import { logger } from '@/utils/logger';
import prisma from '@/config/database';
import { validateSecurityConfig } from '@/config/security';
import authRoutes from '@/routes/auth.routes';
import vehicleRoutes from '@/routes/vehicle.routes';
import accountRoutes from '@/routes/account.routes';
import facebookRoutes from '@/routes/facebook.routes';
import syncRoutes from '@/routes/sync.routes';
import userCredentialsRoutes from '@/routes/userCredentials.routes';
import emailRoutes from '@/routes/email.routes';
import { initializeQueueProcessor } from '@/jobs/queueProcessor';
import { schedulerService } from '@/services/scheduler.service';
import { shutdownEmailQueue } from '@/queues/email.queue';
import { intelliceilService } from '@/services/intelliceil.service';
import { intelliceilMiddleware, intelliceilMonitor } from '@/middleware/intelliceil';
import intelliceilRoutes from '@/routes/intelliceil.routes';
import { iipcService } from '@/services/iipc.service';
import { iipcCheck } from '@/middleware/iipc';
import iipcRoutes from '@/routes/iipc.routes';
import postingRoutes from '@/routes/posting.routes';
import { autoPostService } from '@/services/autopost.service';
import sessionTracker, { 
  trackUserSession, 
  trackSessionActivity, 
  trackVisitorSession 
} from '@/middleware/session-tracker';
import { ipIntelligenceService } from '@/services/ip-intelligence.service';

// Validate security configuration on startup
validateSecurityConfig();

console.log('🔵 All modules loaded successfully');

const app: Application = express();
const PORT = process.env.PORT || 3000;

console.log('🔵 Express app created');

// ============================================
// Global error handlers
// ============================================
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  process.exit(1);
});

// ============================================
// Serve React Frontend (Static Files) - FIRST!
// Serve static files before any security middleware
// ============================================
const webDistPath = path.join(__dirname, '../web/dist');
console.log('🔵 Static files path:', webDistPath);

// Serve static assets with proper MIME types and caching
app.use(express.static(webDistPath, {
  maxAge: '1y',
  etag: true,
  index: false, // Don't serve index.html for directory requests (handled by SPA fallback)
  setHeaders: (res, filePath) => {
    // Set correct MIME types explicitly
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    } else if (filePath.endsWith('.svg')) {
      res.setHeader('Content-Type', 'image/svg+xml');
    } else if (filePath.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json');
    } else if (filePath.endsWith('.woff') || filePath.endsWith('.woff2')) {
      res.setHeader('Content-Type', filePath.endsWith('.woff2') ? 'font/woff2' : 'font/woff');
    }
  }
}));

// ============================================
// Security Middleware (after static files)
// ============================================

// Cookie parser for visitor fingerprinting
app.use(cookieParser());

// Intelliceil - Anti-DDoS & Exchange Security (monitors all traffic)
app.use(intelliceilMonitor);

// IIPC - Internal IP Controller (tracks client IPs for access control)
app.use(iipcCheck);

// Intelliheat Visitor Tracking - Track all visitors with heat scores
// This persists visitor data, bot detection, and IP intelligence to database
app.use(async (req, res, next) => {
  try {
    // Skip static files and health checks
    if (req.path.startsWith('/assets') || req.path === '/health' || req.path.endsWith('.js') || req.path.endsWith('.css')) {
      return next();
    }
    
    // Get visitor fingerprint from cookie or generate new one
    const fingerprint = req.cookies?.['_vf'] || `anon_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const ipAddress = sessionTracker.getClientIP(req);
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const country = req.intelliceil?.country;
    const city = req.intelliceil?.city;
    
    // Track visitor asynchronously (don't block request)
    ipIntelligenceService.trackVisitor(fingerprint, ipAddress, userAgent, country, city).catch(() => {});
    
    // Set fingerprint cookie if not present
    if (!req.cookies?.['_vf']) {
      res.cookie('_vf', fingerprint, { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'lax' });
    }
    
    next();
  } catch (error) {
    // Don't block on tracking errors
    next();
  }
});

// Visitor Session Tracking - Create VisitorSession records for anonymous users
// This enables full session analytics for non-authenticated visitors
app.use(trackVisitorSession);

// API-specific Intelliceil protection (blocks malicious traffic)
app.use('/api', intelliceilMiddleware);

// IP Filtering and suspicious activity tracking (first line of defense for API)
app.use('/api', ipFilter);
app.use('/api', suspiciousActivityTracker);

// Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: [
        "'self'",
        "https://graph.facebook.com",
        "https://dealersface.com",
        "https://www.dealersface.com",
        "wss://dealersface.com",
        "wss://www.dealersface.com",
      ],
      fontSrc: ["'self'", "data:"],
      frameSrc: ["'self'", "https://www.facebook.com"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  crossOriginEmbedderPolicy: false, // Allow embedding for OAuth flows
}));

// Additional security headers
app.use(securityHeaders);

// ============================================
// CORS Configuration (Cloudflare Production)
// ============================================
const allowedOrigins = [
  // Development
  'http://localhost:3000',
  'http://localhost:5173', // Vite dev server
  // Production (via Cloudflare)
  'https://dealersface.com',
  'https://www.dealersface.com',
  // Facebook origins (for extension content scripts running on Facebook pages)
  'https://www.facebook.com',
  'https://facebook.com',
  'https://m.facebook.com',
  // Chrome Extension origins (handled separately below)
  ...(process.env.ALLOWED_ORIGINS?.split(',') || []),
  process.env.API_URL,
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman, server-to-server, Cloudflare workers)
    if (!origin || origin === '') {
      return callback(null, true);
    }
    
    // Allow Chrome extension requests
    if (origin.startsWith('chrome-extension://')) {
      return callback(null, true);
    }
    
    // Allow moz-extension (Firefox)
    if (origin.startsWith('moz-extension://')) {
      return callback(null, true);
    }
    
    // Allow Cloudflare Workers
    if (origin.includes('cloudflare') || origin.includes('workers.dev')) {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked request from origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'X-CSRF-Token', 
    'X-Request-Signature', 
    'X-Request-Timestamp',
    // Cloudflare headers
    'CF-Connecting-IP',
    'CF-Ray',
    'CF-IPCountry',
    'CF-Visitor',
  ],
  exposedHeaders: ['X-CSRF-Token', 'CF-Ray'],
  maxAge: 86400, // 24 hours
}));

// ============================================
// Rate Limiting (Legacy - kept for additional protection)
// ============================================
app.use('/api/', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', passwordResetLimiter);

// ============================================
// IIPC Emergency Endpoints (BEFORE gateway - No auth, IP verified only)
// These must be defined before the secure gateway so they bypass auth
// ============================================

// Body parser for emergency endpoints only
app.use('/api/iipc/emergency-reset', express.json());
app.use('/api/iipc/promote-super-admin', express.json());

// Emergency Rate Limit Reset
app.post('/api/iipc/emergency-reset', async (req, res): Promise<void> => {
  const { resetRateLimitsForIP } = await import('@/middleware/security');
  
  const forwardedFor = req.headers['x-forwarded-for'];
  const clientIP = forwardedFor 
    ? (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(',')[0]).trim()
    : req.ip || 'unknown';
  
  if (!iipcService.isSuperAdminIP(clientIP)) {
    logger.warn(`Unauthorized emergency reset attempt from IP: ${clientIP}`);
    res.status(403).json({ 
      success: false, 
      error: 'Forbidden - IP not authorized',
      yourIP: clientIP,
    });
    return;
  }
  
  const result = await resetRateLimitsForIP(clientIP);
  logger.info(`Emergency rate limit reset by super admin IP: ${clientIP}`);
  
  res.json({
    success: true,
    message: `Rate limits cleared for your IP (${clientIP})`,
    data: result,
  });
});

// Emergency Super Admin Promotion
app.post('/api/iipc/promote-super-admin', async (req, res): Promise<void> => {
  const forwardedFor = req.headers['x-forwarded-for'];
  const clientIP = forwardedFor 
    ? (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(',')[0]).trim()
    : req.ip || 'unknown';
  
  if (!iipcService.isSuperAdminIP(clientIP)) {
    logger.warn(`Unauthorized super admin promotion attempt from IP: ${clientIP}`);
    res.status(403).json({ 
      success: false, 
      error: 'Forbidden - IP not authorized',
      yourIP: clientIP,
    });
    return;
  }
  
  const { email } = req.body;
  
  if (!email) {
    res.status(400).json({ success: false, error: 'Email is required' });
    return;
  }
  
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { accountUsers: true },
    });
    
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    
    if (user.accountUsers.length > 0) {
      await prisma.accountUser.updateMany({
        where: { userId: user.id },
        data: { role: 'SUPER_ADMIN' },
      });
    } else {
      const account = await prisma.account.create({
        data: {
          name: 'System Admin Account',
          dealershipName: 'Dealers Face Admin',
        },
      });
      
      await prisma.accountUser.create({
        data: {
          userId: user.id,
          accountId: account.id,
          role: 'SUPER_ADMIN',
        },
      });
    }
    
    logger.info(`User ${email} promoted to SUPER_ADMIN by IP: ${clientIP}`);
    
    res.json({
      success: true,
      message: `User ${email} has been promoted to SUPER_ADMIN`,
      userId: user.id,
    });
  } catch (error: any) {
    logger.error('Failed to promote super admin:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Emergency Diagnostic - Check User Role (IP verified only)
app.use('/api/iipc/check-user', express.json());
app.post('/api/iipc/check-user', async (req, res): Promise<void> => {
  const forwardedFor = req.headers['x-forwarded-for'];
  const clientIP = forwardedFor 
    ? (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(',')[0]).trim()
    : req.ip || 'unknown';
  
  if (!iipcService.isSuperAdminIP(clientIP)) {
    res.status(403).json({ success: false, error: 'Forbidden' });
    return;
  }
  
  const { email } = req.body;
  
  if (!email) {
    res.status(400).json({ success: false, error: 'Email is required' });
    return;
  }
  
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { 
        accountUsers: {
          include: { account: true }
        }
      },
    });
    
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive,
      },
      accounts: user.accountUsers.map(au => ({
        accountId: au.accountId,
        accountName: au.account.name,
        role: au.role,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// 7-Ring Secure API Gateway
// ============================================
// All API routes go through the secure gateway with 7 layers of protection:
// Ring 1: Gateway Path Verification
// Ring 2: IP Sentinel (whitelist/blacklist)
// Ring 3: Rate Shield (token bucket)
// Ring 4: Request Validator (injection prevention)
// Ring 5: Auth Barrier (JWT - applied per route)
// Ring 6: API Key Fortress
// Ring 7: RBAC Guardian
const secureGateway = createSecureGateway();
app.use('/api', secureGateway);

// ============================================
// Body Parsing (API only)
// ============================================
app.use('/api', express.json({ limit: '10mb' }));
app.use('/api', express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// Request Sanitization (after body parsing, API only)
// ============================================
app.use('/api', sanitizeRequest);
app.use('/api', injectionGuard);

// ============================================
// Security Context & CSRF Protection
// ============================================
// Attach security context (request ID, IP, user agent) for audit logging
app.use('/api', attachSecurityContext);

// Provide CSRF tokens on all requests
app.use('/api', csrfTokenProvider);

// Apply CSRF protection to state-changing operations
// Skip for webhook endpoints, OAuth callbacks, and public auth endpoints
app.use('/api', (req, res, next) => {
  // Skip CSRF for webhooks, OAuth callbacks, and public auth endpoints
  // Note: req.path doesn't include /api since middleware is mounted at /api
  const skipPaths = [
    '/subscriptions/webhook',
    '/facebook/callback',
    '/facebook/deauthorize',
    '/facebook/data-deletion',
    '/auth/facebook/callback',
    '/extension/', // All extension endpoints (Chrome extension uses JWT, not CSRF)
    // Training console endpoints (extension uses JWT, not CSRF)
    '/training/console/heartbeat',
    '/training/console/status',
    // Public auth endpoints (no CSRF token available yet)
    '/auth/login',
    '/auth/register',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/refresh-token',
    '/auth/verify-email',
    '/auth/health',
    '/auth/debug-login',
    '/auth/extension-login', // Extension login redirect
    // Super Admin impersonation endpoints (uses JWT auth, not CSRF)
    '/auth/impersonate',
    '/auth/impersonation',
    '/auth/end-impersonation',
    // AI Center endpoints (uses auth token)
    '/ai-center/chat',
    '/ai-center/models',
    '/ai-center/settings',
    '/ai/',  // All AI endpoints
    // File upload endpoints (multipart/form-data doesn't work well with CSRF)
    '/sync/upload',
    '/sync/manual',
    '/sync/trigger',
    '/vehicles', // Vehicle management
    // Messages endpoints
    '/messages/',
    // Analytics endpoints
    '/analytics',
    // Team management endpoints
    '/team/',
    // Lead management
    '/leads',
    // Accounts management
    '/accounts',
    // Admin routes (Super Admin authenticated via JWT)
    '/admin/',
    // IAI Admin routes (prototype browser testing)
    '/admin/iai',
    // AI Center routes (AI memory, chat)
    '/ai-center',
    '/ai/',
    // Facebook session management (admin-authenticated)
    '/facebook/session',
  ];
  
  if (skipPaths.some(p => req.path.startsWith(p))) {
    return next();
  }
  
  // Skip CSRF for API key authenticated requests
  if (req.headers['x-api-key']) {
    return next();
  }
  
  // Apply CSRF protection
  csrfProtection(req, res, next);
});

// ============================================
// Request Logging (API only)
// ============================================
app.use('/api', (req, _res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// ============================================
// Health Check (Internal monitoring only)
// ============================================
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ============================================
// API Routes (Protected by 7-Ring Security Gateway)
// ============================================
// All routes under /api are secured by the gateway middleware
// Individual routes add Ring 5 (Auth) as needed
app.use('/api/auth', authRoutes);                                              // Auth routes (public)
app.use('/api/auth/2fa', ring5AuthBarrier, require('./routes/two-factor.routes').default); // 2FA routes (requires auth)

// ============================================
// Session Tracking Middleware (After Auth)
// ============================================
// Track authenticated user sessions and activity
// This creates UserSession records in the database for analytics
app.use('/api', (req, res, next) => {
  // Only track after authentication has been verified
  // This runs after auth middleware processes the request
  if ((req as any).user) {
    trackUserSession(req as any, res, () => {
      trackSessionActivity(req as any, res, next);
    });
  } else {
    next();
  }
});

// Facebook OAuth callback must be public (browser redirect)
// IMPORTANT: This specific route MUST be before the general /api/facebook routes
app.get('/api/facebook/callback', (req, res, next) => {
  // Skip auth for callback - handled via signed state
  const controller = new (require('./controllers/facebook.controller').FacebookController)();
  controller.handleOAuthCallback(req, res).catch(next);
});

// Public Facebook config endpoint for extension (no auth required)
// Returns only public, non-sensitive config (App ID, version, etc.)
app.get('/api/config/facebook', async (_req, res) => {
  const systemController = require('./controllers/system.controller');
  systemController.getPublicFacebookConfig(_req, res, (err: Error) => {
    res.status(500).json({ success: false, error: err.message });
  });
});

// Cloud AI Sales Assistant - PUBLIC (no auth required for potential customers)
app.use('/api/cloud', require('./routes/cloud.routes').default);

app.use('/api/facebook', ring5AuthBarrier, facebookRoutes);                    // Other facebook routes require auth

app.use('/api/vehicles', ring5AuthBarrier, vehicleRoutes);                     // Requires auth
app.use('/api/accounts', ring5AuthBarrier, accountRoutes);                     // Requires auth
app.use('/api/team', ring5AuthBarrier, require('./routes/team.routes').default); // Team management (requires auth)
app.use('/api/sync', ring5AuthBarrier, syncRoutes);                            // Requires auth
app.use('/api/users/me', ring5AuthBarrier, userCredentialsRoutes);             // Requires auth
app.use('/api/users/me/api-keys', ring5AuthBarrier, require('./routes/apiKey.routes').default);
app.use('/api/subscriptions', require('./routes/subscription.routes').default); // Mixed (webhook is public)
app.use('/api/admin', ring5AuthBarrier, require('./routes/admin.routes').default); // Requires admin
app.use('/api/admin/api-dashboard', ring5AuthBarrier, require('./routes/apiDashboard.routes').default); // API Dashboard (super admin)
app.use('/api/admin/production', ring5AuthBarrier, require('./routes/production.routes').default); // Production system control (super admin)
app.use('/api/email', ring5AuthBarrier, emailRoutes);                          // Requires auth
app.use('/api/leads', ring5AuthBarrier, require('./routes/lead.routes').default); // Requires auth
app.use('/api/messages', ring5AuthBarrier, require('./routes/message.routes').default); // Messages/conversations (requires auth)
app.use('/api/analytics', ring5AuthBarrier, require('./routes/analytics.routes').default); // Analytics dashboard (requires auth)
app.use('/api/intelliceil', ring5AuthBarrier, intelliceilRoutes);              // Requires admin (Intelliceil dashboard)
app.use('/api/session-analytics', require('./routes/session-analytics.routes').default); // Session & visitor analytics
app.use('/api/iipc', ring5AuthBarrier, iipcRoutes);                            // Requires admin (IIPC dashboard)
app.use('/api/reports', ring5AuthBarrier, require('./routes/reports.routes').default); // Reports & notifications
app.use('/api/posting', ring5AuthBarrier, postingRoutes);                      // Auto-posting settings & triggers
app.use('/api/workers', ring5AuthBarrier, require('./routes/worker.routes').default); // Python worker management

// Super Admin Dashboard Routes (requires super admin access)
app.use('/api/dashboard', ring5AuthBarrier, require('./routes/dashboard.routes').default); // Dashboard analytics (RBAC protected)

// User Settings Routes (requires auth)
app.use('/api/settings', ring5AuthBarrier, require('./routes/user-settings.routes').default); // User settings & preferences

// ============================================
// Facebook Session-Based Auth (REPLACES OAuth)
// ============================================
app.use('/api/fb-session', ring5AuthBarrier, require('./routes/fb-session.routes').default); // Session capture & sync

// Chrome Extension AI Hybrid System
// DEPRECATED: OAuth routes kept for backwards compatibility - will return 410 Gone
app.use('/api/auth/facebook', require('./routes/facebook-auth.routes').default); // Facebook OAuth (DEPRECATED)
app.use('/api/extension', ring5AuthBarrier, require('./routes/extension.routes').default); // Extension API (requires auth)

// IAI Soldier Command Center
app.use('/api/admin/iai', ring5AuthBarrier, require('./routes/iai.routes').default); // IAI soldier tracking (admin)
app.use('/api/extension/iai', ring5AuthBarrier, require('./routes/iai.routes').default); // IAI soldier registration/heartbeat

// IAI Training System (Super Admin only)
// PUBLIC Heartbeat endpoints - must be BEFORE ring5AuthBarrier for extension access
const trainingRoutes = require('./routes/training.routes');
app.post('/api/training/console/heartbeat', express.json(), (req, res) => {
  // Forward to training routes heartbeat handler
  trainingRoutes.handleHeartbeat(req, res);
});
app.get('/api/training/console/status', (_req, res) => {
  // Forward to training routes status handler
  trainingRoutes.getConsoleStatus(_req, res);
});
app.use('/api/training', ring5AuthBarrier, trainingRoutes.default); // Training recording & injection

// AI Center Routes (requires super admin)
app.use('/api/ai-center', ring5AuthBarrier, require('./routes/ai-center.routes').default); // AI Center (requires admin)

// AI Model Registry & Agent Management (requires admin)
app.use('/api/ai-models', ring5AuthBarrier, require('./routes/ai-models.routes').default); // AI model selection & agent management

// AI Chat Routes - Nova's Backend (requires auth, handles own file uploads)
app.use('/api/ai', ring5AuthBarrier, require('./routes/ai-chat.routes').default); // AI Chat with memory system

// Error Monitoring & AI Intervention System
app.use('/api/error-monitoring', ring5AuthBarrier, require('./routes/error-monitoring.routes').default); // Error monitoring & AI intervention

// Nova Monitoring Integration (AI-powered error alerts & chat history)
app.use('/api/nova', require('./routes/nova-monitoring.routes').default); // Nova monitoring (mixed auth - SSE public with token)

// Abstraction Center - Unified IAI Extension & Nova Soldiers Dashboard
app.use('/api/abstraction', ring5AuthBarrier, require('./routes/abstraction.routes').default); // Abstraction Center (super admin)

// FBM Posts Tracking & Debugging System
app.use('/api/fbm-posts', ring5AuthBarrier, require('./routes/fbm-posts.routes').default); // FBM post tracking (requires auth)

// ============================================
// SPA Fallback - serve index.html for all non-API routes
// ============================================
app.get('*', (req, res, next) => {
  // Skip API routes and health check
  if (req.path.startsWith('/api/') || req.path === '/health') {
    return next();
  }
  
  // Skip asset requests that should have been handled by static middleware
  if (req.path.startsWith('/assets/')) {
    console.error('⚠️ Asset not found:', req.path);
    return res.status(404).send('Asset not found');
  }
  
  res.sendFile(path.join(webDistPath, 'index.html'), (err) => {
    if (err) {
      console.error('❌ Error serving index.html:', err);
      // If web/dist doesn't exist, fall through to 404
      next();
    }
  });
});

// ============================================
// 404 Handler (for API routes only now)
// ============================================
app.use('/api/*', (_req, res) => {
  res.status(404).json({
    success: false,
    message: 'API route not found',
  });
});

// ============================================
// Error Handler
// ============================================
app.use(errorHandler);

// ============================================
// Server Initialization
// ============================================
const startServer = async () => {
  try {
    // Test database connection
    logger.info('Testing database connection...');
    await prisma.$connect();
    logger.info('✅ Database connected successfully');

    // Initialize background job processor (optional - gracefully handle Redis unavailability)
    try {
      await initializeQueueProcessor();
      logger.info('✅ Queue processor initialized');
    } catch (error) {
      logger.warn('⚠️  Queue processor initialization failed (Redis may not be available):', error);
      logger.info('Continuing without background job processing...');
    }

    // Initialize auto-sync scheduler (optional)
    try {
      schedulerService.initialize();
      logger.info('✅ Auto-sync scheduler initialized');
    } catch (error) {
      logger.warn('⚠️  Auto-sync scheduler initialization failed:', error);
      logger.info('Continuing without auto-sync...');
    }

    // Initialize Intelliceil security system
    try {
      await intelliceilService.initialize();
      logger.info('✅ Intelliceil security system initialized');
    } catch (error) {
      logger.warn('⚠️  Intelliceil initialization failed:', error);
      logger.info('Continuing with basic security...');
    }

    // Initialize IIPC (Internal IP Controller)
    try {
      await iipcService.initialize();
      logger.info('✅ IIPC (IP Access Control) initialized');
    } catch (error) {
      logger.warn('⚠️  IIPC initialization failed:', error);
      logger.info('Continuing without IP access control...');
    }

    // Initialize Auto-Post Service (Glo3D-style auto-posting)
    try {
      autoPostService.initialize();
      logger.info('✅ AutoPost service initialized (Glo3D-style scheduling)');
    } catch (error) {
      logger.warn('⚠️  AutoPost service initialization failed:', error);
      logger.info('Continuing without auto-posting...');
    }

    // Initialize Worker Queue Service (Python headless browser workers)
    try {
      const { workerQueueService } = await import('@/services/worker-queue.service');
      await workerQueueService.initialize();
      if (workerQueueService.isAvailable()) {
        logger.info('✅ Worker Queue service initialized (Python headless browsers)');
      } else {
        logger.info('ℹ️  Worker Queue service not configured (REDIS_URL not set)');
      }
    } catch (error) {
      logger.warn('⚠️  Worker Queue service initialization failed:', error);
      logger.info('Continuing without Python workers...');
    }

    // Initialize Dashboard Services (Super Admin Dashboard)
    try {
      const { dashboardMetricsService } = await import('@/services/dashboard-metrics.service');
      const { facebookHealthIntelligenceService } = await import('@/services/facebook-health-intelligence.service');
      const { riskAssessmentService } = await import('@/services/risk-assessment.service');
      const { connectionMethodService } = await import('@/services/connection-method.service');
      
      await Promise.all([
        dashboardMetricsService.initialize(),
        facebookHealthIntelligenceService.initialize(),
        riskAssessmentService.initialize(),
        connectionMethodService.initialize(),
      ]);
      logger.info('✅ Dashboard services initialized (Metrics, FB Health, Risk Assessment, Connection Methods)');
    } catch (error) {
      logger.warn('⚠️  Dashboard services initialization failed:', error);
      logger.info('Continuing without dashboard features...');
    }

    // Initialize Error Monitoring & AI Intervention System
    try {
      const { errorMonitoringService } = await import('@/services/error-monitoring.service');
      // AI Intervention service is initialized on-demand via event handlers
      await import('@/services/ai-intervention.service');
      
      await errorMonitoringService.initialize();
      logger.info('✅ Error Monitoring service initialized (3-minute scanning cycle)');
      logger.info('✅ AI Intervention service ready');
    } catch (error) {
      logger.warn('⚠️  Error Monitoring service initialization failed:', error);
      logger.info('Continuing without error monitoring...');
    }

    // Initialize Nova Monitoring Integration (wires error monitoring to Nova AI)
    try {
      const { novaMonitoringService } = await import('@/services/nova-monitoring.service');
      await novaMonitoringService.initialize();
      logger.info('✅ Nova Monitoring service initialized (error alerts wired to Nova AI)');
    } catch (error) {
      logger.warn('⚠️  Nova Monitoring service initialization failed:', error);
      logger.info('Continuing without Nova monitoring integration...');
    }

    // Auto-promote default super admin users from environment
    const DEFAULT_SUPER_ADMINS = process.env.DEFAULT_SUPER_ADMINS?.split(',').map(e => e.trim().toLowerCase()) || [];
    for (const email of DEFAULT_SUPER_ADMINS) {
      if (!email) continue;
      try {
        const user = await prisma.user.findUnique({
          where: { email },
          include: { accountUsers: true },
        });
        
        if (user) {
          const isSuperAdmin = user.accountUsers.some(au => au.role === 'SUPER_ADMIN');
          if (!isSuperAdmin && user.accountUsers.length > 0) {
            await prisma.accountUser.updateMany({
              where: { userId: user.id },
              data: { role: 'SUPER_ADMIN' },
            });
            logger.info(`✅ Auto-promoted ${email} to SUPER_ADMIN`);
          }
        }
      } catch (error) {
        logger.warn(`⚠️  Failed to auto-promote user:`, error);
      }
    }

    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
      logger.info(`📡 Health check available at: http://localhost:${PORT}/health`);
      logger.info(`🛡️ Intelliceil security active`);
      
      // Initialize scheduled jobs for reports and notifications
      const { initScheduledJobs } = require('./services/scheduled-jobs.service');
      initScheduledJobs();
      logger.info(`📧 Scheduled email reports initialized`);
      
      // Initialize API Dashboard health checks (delayed to allow server to fully start)
      setTimeout(async () => {
        try {
          const { initializeHealthChecks } = require('./controllers/apiDashboard.controller');
          await initializeHealthChecks();
          logger.info(`📊 API Dashboard health checks initialized`);
        } catch (error) {
          logger.warn('⚠️ Failed to initialize API Dashboard health checks:', error);
        }
      }, 3000); // Wait 3 seconds for server to be fully ready
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    if (error instanceof Error) {
      logger.error('Error details:', error.message);
      logger.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  schedulerService.shutdown();
  autoPostService.shutdown();
  intelliceilService.shutdown();
  iipcService.shutdown();
  const { stopAllJobs } = require('./services/scheduled-jobs.service');
  stopAllJobs();
  // Shutdown error monitoring service
  try {
    const { errorMonitoringService } = await import('@/services/error-monitoring.service');
    errorMonitoringService.shutdown();
  } catch {}
  await shutdownEmailQueue();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  schedulerService.shutdown();
  autoPostService.shutdown();
  intelliceilService.shutdown();
  iipcService.shutdown();
  const { stopAllJobs } = require('./services/scheduled-jobs.service');
  stopAllJobs();
  // Shutdown error monitoring service
  try {
    const { errorMonitoringService } = await import('@/services/error-monitoring.service');
    errorMonitoringService.shutdown();
  } catch {}
  await shutdownEmailQueue();
  process.exit(0);
});

startServer();

export default app;
