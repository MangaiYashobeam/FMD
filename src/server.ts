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
// Enterprise Security - PCI-DSS & SOC2 Compliant
import {
  enterpriseSecurityHeaders,
  sensitiveDataCacheControl,
  clearSiteDataOnLogout,
  pciAuditLogger,
  deepSanitizeRequest,
  advancedInjectionGuard,
  threatIntelligenceCheck,
} from '@/middleware/enterprise-security.middleware';
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
import { intelliceilEnterpriseMiddleware, validateInput, honeypotTrap } from '@/middleware/intelliceil.middleware';
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

// ============================================
// VITAL ORGANS - GREEN ROUTE & IAI BYPASS
// ============================================
// These routes MUST be defined before security middleware to prevent lockout
// They implement their own strict security (signatures/tokens)

// 1. Green Route - Encrypted Tunnel (Bypasses WAF/IP Filter)
// Uses its own body parsing and signature verification
app.use('/api/green', express.json({limit: '50mb'}), require('./routes/green-route.routes').default);

// 2. IAI Soldier Heartbeat & Registration (Critical for automation)
// We hoist this to ensure soldiers can report in even under high security mode/attack
// Note: We use express.json() here because global parser is applied later to /api
app.use('/api/extension/iai', express.json({limit: '50mb'}), ring5AuthBarrier, require('./routes/iai.routes').default);

// 3. Extension Token Exchange (Critical for auth recovery)
app.use('/api/extension/token', express.json(), require('./routes/extension-token.routes').default);

// ============================================
// END VITAL ORGANS
// ============================================

// API-specific Intelliceil protection (blocks malicious traffic)
app.use('/api', intelliceilMiddleware);

// Honeypot trap endpoints (catch scanners and attackers)
app.use(honeypotTrap);

// Enterprise Security Middleware - SQL Injection, XSS, Bot Detection, IP Reputation
// This performs comprehensive security checks on ALL API requests
app.use('/api', intelliceilEnterpriseMiddleware);

// Input validation middleware - Additional SQL/XSS scanning for request bodies
app.use('/api', validateInput);

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
// Increase limit for training session uploads which can be large
app.use('/api/training', express.json({ limit: '50mb' }));
app.use('/api/training', express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/api', express.json({ limit: '10mb' }));
app.use('/api', express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// Request Sanitization (after body parsing, API only)
// ============================================
app.use('/api', sanitizeRequest);
app.use('/api', injectionGuard);

// ============================================
// Enterprise Security Layer (PCI-DSS & SOC2 Compliant)
// ============================================
// 1. PCI Audit Logging - All requests logged with compliance tags
app.use('/api', pciAuditLogger);

// 2. Enterprise Security Headers (CSP, HSTS, X-Frame-Options, etc.)
app.use('/api', enterpriseSecurityHeaders);

// 3. Sensitive Data Cache Control
app.use('/api', sensitiveDataCacheControl);

// 4. Clear Site Data on Logout
app.use('/api', clearSiteDataOnLogout);

// 5. Threat Intelligence Check
app.use('/api', threatIntelligenceCheck);

// 6. Deep Sanitization (advanced XSS/Injection prevention)
app.use('/api', deepSanitizeRequest);

// 7. Advanced Injection Guard
app.use('/api', advancedInjectionGuard);

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
    '/training/console/log',
    '/training/upload',    // Training session upload from extension (public)
    '/training/sessions', // Training session uploads from extension
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
    // FB Session capture/sync from extension (uses JWT auth, not CSRF)
    '/fb-session/',
    // IAI public endpoints (extension uses own token/no CSRF)
    '/iai/',
    // Python worker endpoints (authenticated via X-Worker-Secret header)
    '/worker/',
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

// Detailed health check for admin dashboard
app.get('/api/health', async (_req, res) => {
  const startTime = Date.now();
  
  // Check database connection
  let dbStatus = 'ok';
  let dbResponseTime = 0;
  try {
    const dbStart = Date.now();
    const { default: prisma } = await import('@/config/database');
    await prisma.$queryRaw`SELECT 1`;
    dbResponseTime = Date.now() - dbStart;
  } catch (error) {
    dbStatus = 'down';
    console.error('Health check - DB error:', error);
  }
  
  // Check Intelliceil security service
  let securityStatus = 'ok';
  try {
    const { intelliceilService } = await import('./services/intelliceil.service');
    const status = intelliceilService.getStatus();
    if (!status.config.enabled) {
      securityStatus = 'degraded';
    }
  } catch (error) {
    securityStatus = 'down';
  }
  
  // WebSocket status (always running if server is up)
  const wsStatus = 'ok';
  
  const apiResponseTime = Date.now() - startTime;
  
  res.json({
    success: true,
    data: {
      status: dbStatus === 'down' ? 'down' : 'ok',
      services: {
        api: { 
          status: 'ok', 
          responseTime: apiResponseTime 
        },
        database: { 
          status: dbStatus, 
          responseTime: dbResponseTime 
        },
        websocket: { 
          status: wsStatus 
        },
        security: { 
          status: securityStatus 
        },
      },
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
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

// Public IAI Pattern Endpoint - For extension to load workflow patterns
// No auth required - returns only active/default pattern for IAI soldiers
// Supports ?ultraSpeed=true to fetch from USM container
// Supports ?soldierId=xxx to update soldier's current pattern tracking
app.get('/api/iai/pattern', async (req, res): Promise<void> => {
  try {
    const { injectionService } = require('./services/injection.service');
    const prisma = require('./config/database').default;
    
    const ultraSpeed = req.query.ultraSpeed === 'true' || req.query.usm === 'true';
    const soldierId = req.query.soldierId as string | undefined;
    const accountId = req.query.accountId as string | undefined;
    
    let container = null;
    let pattern = null;
    let patternSource = ultraSpeed ? 'usm' : 'weighted';
    
    // Check for pattern override first if we have accountId
    if (accountId) {
      const effectiveResult = await injectionService.getEffectivePattern(accountId);
      if (effectiveResult.pattern && effectiveResult.source === 'override') {
        pattern = effectiveResult.pattern;
        patternSource = 'override';
        // Get container info
        container = await injectionService.getContainer(pattern.containerId, false);
        console.log(`[IAI Pattern] 🎯 Using override pattern: ${pattern.name} for account ${accountId}`);
      }
    }
    
    if (!pattern && ultraSpeed) {
      // Ultra Speed Mode - fetch exclusively from USM container
      console.log('[IAI Pattern] ⚡ Ultra Speed Mode - fetching from USM container');
      const usmResult = await injectionService.selectUSMPattern();
      
      if (usmResult.pattern) {
        pattern = usmResult.pattern;
        container = usmResult.container;
        patternSource = 'usm';
        console.log(`[IAI Pattern] ⚡ USM Pattern selected: ${pattern.name}`);
      } else {
        // Fallback to normal if USM unavailable
        console.log('[IAI Pattern] ⚠️ USM container not available, falling back to normal');
      }
    }
    
    // If no pattern yet (normal mode or USM fallback)
    if (!pattern) {
      // Get active containers
      const { containers } = await injectionService.listContainers({
        isActive: true,
        includePatterns: true,
        limit: 10
      });
      
      if (!containers || containers.length === 0) {
        res.status(404).json({ 
          success: false, 
          error: 'No active injection containers found',
          message: 'Please configure an injection container in the admin panel'
        });
        return;
      }
      
      // Find default or first container
      container = containers.find((c: any) => c.isDefault) || containers[0];
      
      // Get patterns from container - use weighted random selection for hot-swap
      const { patterns } = await injectionService.listPatterns({
        containerId: container.id,
        isActive: true,
        limit: 50
      });
      
      if (!patterns || patterns.length === 0) {
        res.status(404).json({
          success: false,
          error: 'No active patterns found in container',
          containerId: container.id,
          containerName: container.name
        });
        return;
      }
      
      // Weighted random selection based on success count (hot-swap)
      const weightedPatterns = patterns.map((p: any) => ({
        pattern: p,
        calculatedWeight: Math.max(1, p.weight + (p.successCount * 10) - (p.failureCount * 5))
      }));
      
      const totalWeight = weightedPatterns.reduce((sum: number, wp: any) => sum + wp.calculatedWeight, 0);
      let random = Math.random() * totalWeight;
      
      for (const wp of weightedPatterns) {
        random -= wp.calculatedWeight;
        if (random <= 0) {
          pattern = wp.pattern;
          break;
        }
      }
      
      // Fallback to first pattern if selection fails
      if (!pattern) {
        pattern = patterns[0];
      }
      
      patternSource = 'weighted';
      console.log(`[IAI Pattern] 🔄 Hot-swap selected: ${pattern.name} (weight: ${pattern.weight})`);
    }
    
    // Update soldier's current pattern if soldierId provided
    if (soldierId && pattern) {
      try {
        await prisma.iAISoldier.updateMany({
          where: { soldierId },
          data: {
            currentPatternId: pattern.id,
            currentPatternName: pattern.name,
            patternLoadedAt: new Date(),
            patternSource,
          },
        });
        console.log(`[IAI Pattern] 📝 Updated soldier ${soldierId} pattern: ${pattern.name} (source: ${patternSource})`);
      } catch (err) {
        console.error(`[IAI Pattern] Failed to update soldier pattern:`, err);
      }
    }
    
    // Return pattern data for extension
    res.json({
      success: true,
      ultraSpeed: ultraSpeed,
      container: {
        id: container?.id,
        name: container?.name,
        category: container?.category
      },
      pattern: {
        id: pattern.id,
        name: pattern.name,
        version: pattern.version,
        code: pattern.code,
        schema: pattern.schema,
        config: pattern.config,
        tags: pattern.tags
      },
      hotSwap: {
        enabled: true,
        mode: patternSource,
        container: ultraSpeed ? 'IAI Soldiers USM' : 'all'
      },
      loadedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[IAI Pattern] Error loading pattern:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load IAI pattern',
      message: error.message
    });
  }
});

// Public IAI Metrics Endpoint - For extension to report execution metrics
// No auth required - allows extension to report without login
app.post('/api/iai/metrics', async (req, res): Promise<void> => {
  try {
    const { injectionService } = require('./services/injection.service');
    
    const { 
      eventType,
      patternId,
      patternName,
      containerId: _containerId,
      containerName: _containerName,
      stepIndex,
      totalSteps,
      duration,
      success,
      error: _error,
      metadata: _metadata,
      timestamp: _timestamp,
      instanceId: _instanceId,
      vehicleInfo: _vehicleInfo
    } = req.body;

    console.log(`[IAI Metrics] Event: ${eventType}`, {
      patternId,
      patternName,
      success,
      duration,
      stepIndex,
      totalSteps
    });

    // If we have a patternId, update the pattern's execution statistics
    if (patternId && (eventType === 'pattern_execution_complete' || eventType === 'pattern_execution_end')) {
      try {
        const pattern = await injectionService.getPattern(patternId);
        if (pattern) {
          // Update pattern stats
          const updateData: Record<string, number | Date> = {
            totalExecutions: (pattern.totalExecutions || 0) + 1,
            lastExecutedAt: new Date()
          };
          
          if (success) {
            updateData.successCount = (pattern.successCount || 0) + 1;
            if (duration) {
              updateData.avgExecutionTime = pattern.avgExecutionTime 
                ? Math.round((pattern.avgExecutionTime + duration) / 2)
                : duration;
            }
          } else {
            updateData.failureCount = (pattern.failureCount || 0) + 1;
          }

          await injectionService.updatePattern(patternId, updateData);
          console.log(`[IAI Metrics] Updated pattern stats for ${patternId}`);
        }
      } catch (err) {
        console.error(`[IAI Metrics] Failed to update pattern stats:`, err);
      }
    }

    res.json({ 
      success: true, 
      message: 'Metric recorded',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[IAI Metrics] Error recording metric:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record metric',
      message: error.message
    });
  }
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
app.use('/api/enterprise-security', ring5AuthBarrier, require('./routes/enterprise-security.routes').default); // Enterprise Security (super admin)
app.use('/api/session-analytics', require('./routes/session-analytics.routes').default); // Session & visitor analytics
app.use('/api/iipc', ring5AuthBarrier, iipcRoutes);                            // Requires admin (IIPC dashboard)
app.use('/api/reports', ring5AuthBarrier, require('./routes/reports.routes').default); // Reports & notifications
app.use('/api/posting', ring5AuthBarrier, postingRoutes);                      // Auto-posting settings & triggers
app.use('/api/workers', ring5AuthBarrier, require('./routes/worker.routes').default); // Python worker management

// ============================================
// Invitation & Security Routes
// ============================================
app.use('/api/invitations', require('./routes/invitation.routes').default);    // Invitation codes (mixed auth - validate is public)
app.use('/api/security', ring5AuthBarrier, require('./routes/security.routes').default); // Security dashboard (super admin)

// ============================================
// Green Route - Secure Internal API (works during mitigation)
// ============================================
app.use('/api/green', require('./routes/green-route.routes').default); // Green Route (verified ecosystem only)

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

// Extension routes - all require JWT auth (extension has user's token)
app.use('/api/extension', ring5AuthBarrier, require('./routes/extension.routes').default); // Extension API (requires auth)

// ============================================
// Extension Token Exchange (SECURE - No bundled secrets)
// ============================================
// These routes replace the need for bundled secrets in the extension
// Extension calls these to get ephemeral session tokens
app.use('/api/extension/token', require('./routes/extension-token.routes').default); // Token exchange (public)

// IAI Soldier Command Center
app.use('/api/admin/iai', ring5AuthBarrier, require('./routes/iai.routes').default); // IAI soldier tracking (admin)
app.use('/api/extension/iai', ring5AuthBarrier, require('./routes/iai.routes').default); // IAI soldier registration/heartbeat

// 💓 STEALTH SOLDIER ROUTES - Worker-authenticated (X-Worker-Secret header)
// These routes bypass ring5AuthBarrier because they authenticate via worker secret
app.use('/api/worker/iai', express.json(), require('./routes/iai.routes').default); // Python worker heartbeat/activity

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

// AI Orchestrator - Copilot Models, Intelligent Routing, Task Assignments (requires auth)
app.use('/api/ai-orchestrator', ring5AuthBarrier, require('./routes/ai-orchestrator.routes').default); // AI Orchestrator dashboard & management

// AI Chat Routes - Nova's Backend (requires auth, handles own file uploads)
app.use('/api/ai', ring5AuthBarrier, require('./routes/ai-chat.routes').default); // AI Chat with memory system

// IAI Injection System - Pattern/Container management (requires admin)
app.use('/api/injection', ring5AuthBarrier, require('./routes/injection.routes').default); // Injection containers & patterns

// IAI Factory - Blueprint management, instance spawning, orchestration (requires admin)
app.use('/api/iai-factory', ring5AuthBarrier, require('./routes/iai-factory.routes').default); // IAI Factory Control

// Mission Control - Mission planning and execution (requires admin)
app.use('/api/mission-control', ring5AuthBarrier, require('./routes/mission-control.routes').default); // Mission Control system

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

    // Initialize AI Orchestrator Services (Health, Cost, Rate Limiting)
    try {
      const { modelHealthService } = await import('@/services/model-health.service');
      const { rateLimitService } = await import('@/services/rate-limit.service');
      // Import cost tracking service for initialization (used by routes)
      await import('@/services/cost-tracking.service');
      
      // Start health monitoring
      modelHealthService.startMonitoring();
      
      // Load rate limits from DB
      await rateLimitService.loadLimitsFromDB();
      
      // Load health status from DB
      await modelHealthService.loadHealthFromDB();
      
      logger.info('✅ AI Orchestrator services initialized (Health Monitoring, Cost Tracking, Rate Limiting)');
    } catch (error) {
      logger.warn('⚠️  AI Orchestrator services initialization failed:', error);
      logger.info('Continuing without AI orchestrator features...');
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
  // Shutdown AI health monitoring
  try {
    const { modelHealthService } = await import('@/services/model-health.service');
    modelHealthService.stopMonitoring();
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
  // Shutdown AI health monitoring
  try {
    const { modelHealthService } = await import('@/services/model-health.service');
    modelHealthService.stopMonitoring();
  } catch {}
  await shutdownEmailQueue();
  process.exit(0);
});

startServer();

export default app;
