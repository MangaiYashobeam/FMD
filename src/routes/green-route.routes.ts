/**
 * ============================================
 * FaceMyDealer - Green Route API
 * ============================================
 * 
 * Secure internal API endpoints that work during mitigation
 * - All requests are logged and tracked
 * - Only accessible by verified ecosystem clients
 * - Bypasses public route restrictions
 * 
 * SECURITY: Enterprise-grade with SSRF protection, input sanitization
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '@middleware/auth';
import { setAccountContext } from '@middleware/account.middleware';
import { greenRouteVerify, greenRouteLogger } from '@middleware/green-route.middleware';
import prisma from '@config/database';
import { logger } from '@utils/logger';

const router = Router();

// ============================================
// SECURITY: Input Sanitization Utilities
// ============================================

/**
 * Sanitize URL parameter to prevent injection attacks
 */
function sanitizeUrl(url: string | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  
  // Remove control characters and trim
  const cleaned = url.replace(/[\x00-\x1f\x7f]/g, '').trim();
  
  // Length limit to prevent DoS
  if (cleaned.length > 4096) return null;
  
  return cleaned;
}

/**
 * Validate URL is well-formed and uses allowed protocols
 */
function isValidUrl(urlString: string): URL | null {
  try {
    const parsed = new URL(urlString);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

// ============================================
// SECURITY: SSRF Prevention - Domain Allowlist
// ============================================

const ALLOWED_IMAGE_DOMAINS = [
  // Facebook/Meta CDNs
  'scontent.xx.fbcdn.net',
  'external.xx.fbcdn.net',
  'scontent-*.xx.fbcdn.net',
  'lookaside.fbsbx.com',
  'platform-lookaside.fbsbx.com',
  'static.xx.fbcdn.net',
  // Facebook Marketplace images
  'marketplace.fbsbx.com',
  // Common dealer image hosts
  'images.dealer.com',
  'pictures.dealer.com',
  'www.cstatic-images.com',
  'vehicle-photos-published.vauto.com',
  // AWS S3 (our own buckets)
  '.s3.amazonaws.com',
  '.s3.us-east-1.amazonaws.com',
  '.s3.us-west-2.amazonaws.com',
  // Cloudflare
  '.cloudflare.com',
  '.cloudinary.com',
] as const;

/**
 * Check if hostname is in allowlist
 */
function isAllowedDomain(hostname: string): boolean {
  const normalizedHost = hostname.toLowerCase();
  
  return ALLOWED_IMAGE_DOMAINS.some(domain => {
    if (domain.startsWith('.')) {
      // Suffix match (e.g., .s3.amazonaws.com)
      return normalizedHost.endsWith(domain);
    } else if (domain.includes('*')) {
      // Wildcard match (e.g., scontent-*.xx.fbcdn.net)
      const pattern = domain.replace(/\*/g, '[a-z0-9-]+');
      return new RegExp(`^${pattern}$`).test(normalizedHost);
    } else {
      // Exact match
      return normalizedHost === domain;
    }
  });
}

/**
 * Check if hostname is a private/internal IP (SSRF prevention)
 */
function isPrivateAddress(hostname: string): boolean {
  const blockedPrefixes = [
    '10.', '172.16.', '172.17.', '172.18.', '172.19.', 
    '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', 
    '172.25.', '172.26.', '172.27.', '172.28.', '172.29.', 
    '172.30.', '172.31.', '192.168.', '127.', '0.', '169.254.',
    'localhost', '::1', 'fe80::', 'fd00::'
  ];
  
  return blockedPrefixes.some(prefix => 
    hostname.startsWith(prefix) || hostname === 'localhost'
  );
}

// Apply Green Route verification to all routes
router.use(greenRouteVerify);
router.use(greenRouteLogger);

// ============================================
// CORS Headers for Extension Content Scripts
// Green routes are mounted BEFORE global CORS middleware,
// so we need explicit CORS headers for cross-origin requests
// ============================================
router.use((req, res, next) => {
  // Allow cross-origin requests from Facebook and our domains
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://www.facebook.com',
    'https://facebook.com',
    'https://m.facebook.com',
    'https://dealersface.com',
    'https://www.dealersface.com',
  ];
  
  if (!origin || allowedOrigins.includes(origin) || origin.startsWith('chrome-extension://')) {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  
  // Handle preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  next();
});

// ============================================
// HEALTH & STATUS
// ============================================

/**
 * GET /api/green/health
 * Green Route health check - works even during mitigation
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    route: 'green',
    status: 'operational',
    verified: req.greenRoute?.verified || false,
    timestamp: new Date().toISOString()
  });
});

// ============================================
// IMAGE PROXY - CORS Bypass for IAI Soldiers
// ============================================

/**
 * GET /api/green/image-proxy
 * Secure image proxy for IAI soldiers to fetch vehicle images
 * 
 * SECURITY FEATURES:
 * - Domain allowlist (SSRF prevention)
 * - Private IP blocking
 * - Protocol validation (http/https only)
 * - Input sanitization
 * - Content-type validation (images only)
 * - Audit logging
 * 
 * This endpoint does NOT require authentication to allow IAI soldiers
 * to fetch images without having to manage auth tokens for every request.
 * Security is maintained through domain allowlist + verification headers.
 */
router.get('/image-proxy', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  
  try {
    // ========== INPUT VALIDATION ==========
    const rawUrl = req.query.url as string;
    const imageUrl = sanitizeUrl(rawUrl);
    
    if (!imageUrl) {
      logger.warn('[Green Image Proxy] Invalid or missing URL parameter', {
        ip: req.ip,
        userAgent: req.headers['user-agent']?.substring(0, 100)
      });
      res.status(400).json({ 
        error: 'url parameter required',
        code: 'INVALID_URL'
      });
      return;
    }

    // ========== URL VALIDATION ==========
    const parsedUrl = isValidUrl(imageUrl);
    if (!parsedUrl) {
      logger.warn('[Green Image Proxy] Malformed URL', {
        url: imageUrl.substring(0, 100),
        ip: req.ip
      });
      res.status(400).json({ 
        error: 'Invalid URL format',
        code: 'MALFORMED_URL'
      });
      return;
    }
    
    const hostname = parsedUrl.hostname.toLowerCase();
    
    // ========== SSRF PREVENTION: Domain Allowlist ==========
    if (!isAllowedDomain(hostname)) {
      logger.warn(`[Green Image Proxy] SSRF blocked - untrusted domain: ${hostname}`, {
        url: imageUrl.substring(0, 100),
        ip: req.ip,
        verified: req.greenRoute?.verified
      });
      res.status(403).json({ 
        error: 'Domain not allowed',
        code: 'SSRF_BLOCKED'
      });
      return;
    }
    
    // ========== SSRF PREVENTION: Private IP Blocking ==========
    if (isPrivateAddress(hostname)) {
      logger.warn(`[Green Image Proxy] SSRF blocked - internal IP: ${hostname}`, {
        ip: req.ip
      });
      res.status(403).json({ 
        error: 'Internal addresses not allowed',
        code: 'SSRF_BLOCKED'
      });
      return;
    }

    // ========== FETCH IMAGE ==========
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/*,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(15000), // 15s timeout
    });

    if (!response.ok) {
      logger.warn(`[Green Image Proxy] Upstream error: ${response.status}`, {
        url: hostname,
        status: response.status
      });
      res.status(response.status).json({ 
        error: `Failed to fetch image: ${response.statusText}`,
        code: 'UPSTREAM_ERROR'
      });
      return;
    }

    // ========== CONTENT TYPE VALIDATION ==========
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    if (!contentType.startsWith('image/')) {
      logger.warn('[Green Image Proxy] Non-image content type', {
        contentType,
        url: hostname
      });
      res.status(400).json({ 
        error: 'URL does not point to an image',
        code: 'INVALID_CONTENT_TYPE'
      });
      return;
    }

    // ========== SERVE IMAGE ==========
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    
    // Validate size (max 25MB)
    if (imageBuffer.length > 25 * 1024 * 1024) {
      logger.warn('[Green Image Proxy] Image too large', {
        size: imageBuffer.length,
        url: hostname
      });
      res.status(413).json({ 
        error: 'Image too large',
        code: 'PAYLOAD_TOO_LARGE'
      });
      return;
    }

    // Set response headers
    res.set({
      'Content-Type': contentType,
      'Content-Length': imageBuffer.length.toString(),
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      'X-Proxied-From': hostname,
      'X-Green-Route': 'true',
    });

    res.send(imageBuffer);
    
    // ========== AUDIT LOG ==========
    const elapsed = Date.now() - startTime;
    logger.info(`[Green Image Proxy] Served image from ${hostname}`, {
      size: imageBuffer.length,
      elapsed,
      verified: req.greenRoute?.verified,
      source: req.greenRoute?.source
    });
    
  } catch (error) {
    logger.error('[Green Image Proxy] Error:', error);
    res.status(500).json({ 
      error: 'Failed to proxy image',
      code: 'PROXY_ERROR',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/green/status
 * Get system status for extension
 */
router.get('/status', async (_req, res) => {
  try {
    // Check database connectivity
    let dbStatus = 'ok';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'down';
    }

    res.json({
      success: true,
      system: {
        status: dbStatus === 'ok' ? 'operational' : 'degraded',
        database: dbStatus,
        greenRoute: 'active',
        mitigation: false // TODO: Check actual mitigation status
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ============================================
// IAI STEALTH SOLDIERS - VPS Browser Automation
// Green Route proxy to Python workers
// Placed BEFORE authenticate middleware for internal worker access
// ============================================

const WORKER_API_BASE = process.env.WORKER_API_BASE || 'http://worker-api:8000';
const WORKER_SECRET = process.env.WORKER_SECRET || '';

// Type for worker API responses
interface WorkerResponse {
  success?: boolean;
  session_id?: string;
  browser_id?: string;
  status?: string;
  has_saved_session?: boolean;
  message?: string;
  error?: string;
  [key: string]: unknown;
}

/**
 * POST /api/green/stealth/create
 * Create a new stealth browser session
 */
router.post('/stealth/create', async (req: Request, res: Response): Promise<void> => {
  try {
    const { headless = true, proxy = null, userAgent = null, loadSession = false, accountId } = req.body;
    
    logger.info('[Green Stealth] Creating browser session...');
    
    const response = await fetch(`${WORKER_API_BASE}/api/browser/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Worker-Secret': WORKER_SECRET,
      },
      body: JSON.stringify({ 
        headless, 
        proxy, 
        user_agent: userAgent, 
        load_session: loadSession,
        account_id: accountId || 'default'
      }),
    });
    
    const data = await response.json() as WorkerResponse;
    
    res.json({
      success: data.success || false,
      sessionId: data.session_id,  // Use session_id - this is the correct ID for all operations
      browserId: data.browser_id,  // Keep for backwards compatibility
      status: data.status,
      hasSavedSession: data.has_saved_session,
      message: data.message,
      greenRoute: true,
    });
  } catch (error) {
    logger.error('[Green Stealth] Create browser error:', error);
    res.status(500).json({ success: false, error: 'Failed to create stealth browser' });
  }
});

/**
 * POST /api/green/stealth/:id/action
 * Execute action in stealth browser
 */
router.post('/stealth/:id/action', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const action = req.body;
    
    logger.info(`[Green Stealth] Action on ${id}:`, action.action);
    
    const response = await fetch(`${WORKER_API_BASE}/api/browser/${id}/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Worker-Secret': WORKER_SECRET,
      },
      body: JSON.stringify(action),
    });
    
    const data = await response.json() as WorkerResponse;
    
    res.json({
      ...data,
      greenRoute: true,
    });
  } catch (error) {
    logger.error('[Green Stealth] Action error:', error);
    res.status(500).json({ success: false, error: 'Failed to execute stealth action' });
  }
});

/**
 * GET /api/green/stealth/:id/state
 * Get stealth browser state
 */
router.get('/stealth/:id/state', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const response = await fetch(`${WORKER_API_BASE}/api/browser/${id}/state`, {
      headers: { 'X-Worker-Secret': WORKER_SECRET },
    });
    
    const data = await response.json() as WorkerResponse;
    
    res.json({
      ...data,
      greenRoute: true,
    });
  } catch (error) {
    logger.error('[Green Stealth] State error:', error);
    res.status(500).json({ success: false, error: 'Failed to get stealth state' });
  }
});

/**
 * GET /api/green/stealth/:id/screenshot
 * Get stealth browser screenshot
 */
router.get('/stealth/:id/screenshot', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const response = await fetch(`${WORKER_API_BASE}/api/browser/${id}/screenshot`, {
      headers: { 'X-Worker-Secret': WORKER_SECRET },
    });
    
    const data = await response.json() as WorkerResponse;
    
    res.json({
      ...data,
      greenRoute: true,
    });
  } catch (error) {
    logger.error('[Green Stealth] Screenshot error:', error);
    res.status(500).json({ success: false, error: 'Failed to get screenshot' });
  }
});

/**
 * GET /api/green/stealth/:id/html
 * Get stealth browser HTML
 */
router.get('/stealth/:id/html', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const response = await fetch(`${WORKER_API_BASE}/api/browser/${id}/html`, {
      headers: { 'X-Worker-Secret': WORKER_SECRET },
    });
    
    const data = await response.json() as WorkerResponse;
    
    res.json({
      ...data,
      greenRoute: true,
    });
  } catch (error) {
    logger.error('[Green Stealth] HTML error:', error);
    res.status(500).json({ success: false, error: 'Failed to get HTML' });
  }
});

/**
 * POST /api/green/stealth/:id/vision
 * AI vision analysis of stealth browser
 */
router.post('/stealth/:id/vision', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { prompt } = req.body;
    
    const response = await fetch(`${WORKER_API_BASE}/api/browser/${id}/vision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Worker-Secret': WORKER_SECRET,
      },
      body: JSON.stringify({ prompt }),
    });
    
    const data = await response.json() as WorkerResponse;
    
    res.json({
      ...data,
      greenRoute: true,
    });
  } catch (error) {
    logger.error('[Green Stealth] Vision error:', error);
    res.status(500).json({ success: false, error: 'Failed to analyze with vision' });
  }
});

/**
 * DELETE /api/green/stealth/:id
 * Close stealth browser session
 */
router.delete('/stealth/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const response = await fetch(`${WORKER_API_BASE}/api/browser/${id}`, {
      method: 'DELETE',
      headers: { 'X-Worker-Secret': WORKER_SECRET },
    });
    
    const data = await response.json() as WorkerResponse;
    
    res.json({
      ...data,
      greenRoute: true,
    });
  } catch (error) {
    logger.error('[Green Stealth] Delete error:', error);
    res.status(500).json({ success: false, error: 'Failed to close browser' });
  }
});

/**
 * GET /api/green/stealth/pool
 * Get stealth browser pool status
 */
router.get('/stealth/pool', async (_req: Request, res: Response): Promise<void> => {
  try {
    const response = await fetch(`${WORKER_API_BASE}/api/browser/pool`, {
      headers: { 'X-Worker-Secret': WORKER_SECRET },
    });
    
    const data = await response.json() as WorkerResponse;
    
    res.json({
      ...data,
      greenRoute: true,
    });
  } catch (error) {
    logger.error('[Green Stealth] Pool status error:', error);
    res.status(500).json({ success: false, error: 'Failed to get pool status' });
  }
});

// ============================================
// AUTHENTICATED ROUTES
// ============================================

router.use(authenticate);
router.use(setAccountContext);

/**
 * GET /api/green/me
 * Get current user info (for extension session validation)
 */
router.get('/me', async (req, res) => {
  try {
    const user = (req as any).user;
    const accountUser = (req as any).accountUser;

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      },
      account: accountUser ? {
        id: accountUser.accountId,
        role: accountUser.role
      } : null,
      greenRoute: {
        verified: req.greenRoute?.verified,
        whitelisted: req.greenRoute?.whitelisted,
        source: req.greenRoute?.source
      }
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/green/vehicles
 * Get user's vehicles (essential for posting)
 */
router.get('/vehicles', async (req, res) => {
  try {
    const accountUser = (req as any).accountUser;
    
    if (!accountUser) {
      res.status(403).json({ error: 'No account access' });
      return;
    }

    const { status, limit = '50', offset = '0' } = req.query;

    const vehicles = await prisma.vehicle.findMany({
      where: {
        accountId: accountUser.accountId,
        ...(typeof status === 'string' && { status })
      },
      take: parseInt(typeof limit === 'string' ? limit : '50'),
      skip: parseInt(typeof offset === 'string' ? offset : '0'),
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      vehicles,
      total: vehicles.length
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/green/vehicles/:id/post-status
 * Update vehicle post status (after FB posting)
 * Creates or updates FBMPostLog entry
 */
router.post('/vehicles/:id/post-status', async (req, res) => {
  try {
    const user = (req as any).user;
    const accountUser = (req as any).accountUser;
    const { id } = req.params;
    const { posted, postedAt, fbPostId, status = 'completed', errorMessage } = req.body;

    // Verify vehicle belongs to account
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id,
        accountId: accountUser.accountId
      }
    });

    if (!vehicle) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }

    // Create or update FBMPostLog
    let postLog;
    if (posted && status === 'completed') {
      postLog = await prisma.fBMPostLog.create({
        data: {
          accountId: accountUser.accountId,
          vehicleId: id,
          userId: user.id,
          method: 'extension',
          triggerType: 'manual',
          status: 'completed',
          stage: 'verify',
          fbPostId: fbPostId || null,
          success: true,
          initiatedAt: postedAt ? new Date(postedAt) : new Date(),
          completedAt: new Date()
        }
      });
    } else {
      postLog = await prisma.fBMPostLog.create({
        data: {
          accountId: accountUser.accountId,
          vehicleId: id,
          userId: user.id,
          method: 'extension',
          triggerType: 'manual',
          status: status,
          stage: 'init',
          success: false,
          errorMessage: errorMessage || null,
          initiatedAt: new Date()
        }
      });
    }

    res.json({
      success: true,
      postLog: {
        id: postLog.id,
        status: postLog.status,
        success: postLog.success
      }
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/green/fb-session
 * Get Facebook session for extension
 */
router.get('/fb-session', async (req, res) => {
  try {
    const accountUser = (req as any).accountUser;

    const session = await prisma.fbSession.findFirst({
      where: {
        accountId: accountUser.accountId,
        sessionStatus: 'ACTIVE'
      },
      orderBy: { lastUsedAt: 'desc' }
    });

    if (!session) {
      res.status(404).json({ 
        success: false, 
        error: 'No active Facebook session' 
      });
      return;
    }

    res.json({
      success: true,
      session: {
        id: session.id,
        profileName: session.fbUserName,
        profileId: session.fbUserId,
        lastUsedAt: session.lastUsedAt,
        expiresAt: session.expiresAt
      }
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/green/leads
 * Capture lead from Facebook (essential during mitigation)
 */
router.post('/leads', async (req, res) => {
  try {
    const user = (req as any).user;
    const accountUser = (req as any).accountUser;
    const { 
      name, 
      firstName,
      lastName,
      email, 
      phone, 
      vehicleId, 
      source = 'FACEBOOK_MARKETPLACE',
      message 
    } = req.body;

    // Generate lead number
    const leadCount = await prisma.lead.count({ where: { accountId: accountUser.accountId } });
    const leadNumber = `L${accountUser.accountId.slice(0, 4).toUpperCase()}-${(leadCount + 1).toString().padStart(6, '0')}`;

    // Create lead
    const lead = await prisma.lead.create({
      data: {
        accountId: accountUser.accountId,
        leadNumber,
        fullName: name || `${firstName || ''} ${lastName || ''}`.trim() || null,
        firstName,
        lastName,
        email,
        phone,
        vehicleId,
        source: source as any,
        status: 'NEW',
        customerComments: message,
        assignedToId: user.id,
        assignedAt: new Date(),
        metadata: {
          capturedVia: 'green_route',
          capturedAt: new Date().toISOString()
        }
      }
    });

    res.status(201).json({
      success: true,
      lead: {
        id: lead.id,
        leadNumber: lead.leadNumber,
        status: lead.status
      }
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/green/heartbeat
 * Extension heartbeat (keep session alive)
 * 
 * 💓 GREEN ROUTE HEARTBEAT - The extension's pulse!
 */
router.post('/heartbeat', async (req, res) => {
  try {
    const user = (req as any).user;
    const { browserInfo } = req.body;
    
    // 💓 HEARTBEAT LOG
    console.log(`💓 [GREEN HEARTBEAT] User: ${user?.id} | UA: ${browserInfo?.userAgent?.substring(0, 50) || 'unknown'}...`);

    // Update user's last active timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastActiveAt: new Date(),
        lastUserAgent: browserInfo?.userAgent
      }
    });

    console.log(`💚 [GREEN HEARTBEAT] Updated lastActiveAt for user ${user?.id}`);

    res.json({
      success: true,
      ack: true,
      serverTime: new Date().toISOString()
    });
  } catch (error: any) {
    console.error(`❌ [GREEN HEARTBEAT] Error:`, error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/green/posting-config
 * Get posting configuration for extension
 */
router.get('/posting-config', async (req, res) => {
  try {
    const accountUser = (req as any).accountUser;

    const settings = await prisma.accountSettings.findUnique({
      where: { accountId: accountUser.accountId },
      include: {
        postingSettings: true
      }
    });

    res.json({
      success: true,
      config: {
        autoSyncEnabled: settings?.autoSyncEnabled ?? false,
        postsPerRun: settings?.postsPerRun ?? 1,
        syncIntervalHours: settings?.syncIntervalHours ?? 3,
        postIntervalMinutes: settings?.postingSettings?.postIntervalMinutes ?? 20,
        dailyPostLimit: settings?.postingSettings?.dailyPostLimit ?? 0,
        useAiDescription: settings?.useAiDescription ?? false,
        customDescription: settings?.customDescription ?? null
      }
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/green/log-error
 * Log extension error for debugging
 */
router.post('/log-error', async (req, res) => {
  try {
    const user = (req as any).user;
    const accountUser = (req as any).accountUser;
    const { error, context, stack, timestamp } = req.body;

    // Log to console for now (could be stored in DB)
    console.error('[GreenRoute Extension Error]', {
      userId: user.id,
      accountId: accountUser?.accountId,
      error,
      context,
      stack,
      timestamp
    });

    res.json({ success: true, logged: true });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ============================================
// IAI SOLDIER ENDPOINTS (for mitigation bypass)
// ============================================

/**
 * POST /api/green/iai/metrics
 * Record IAI metrics with proper validation
 * 
 * SECURITY: Validates and sanitizes all input data
 */
router.post('/iai/metrics', async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventType, patternId, containerId, soldierId, accountId } = req.body;
    
    // Input validation
    const validEventTypes = ['pattern_loaded', 'task_started', 'task_completed', 'task_failed', 'error'];
    if (!eventType || !validEventTypes.includes(eventType)) {
      res.status(400).json({ 
        success: false, 
        error: 'Invalid event type',
        validTypes: validEventTypes
      });
      return;
    }
    
    // Sanitize string inputs
    const sanitizedData = {
      eventType,
      patternId: patternId?.toString().substring(0, 100),
      containerId: containerId?.toString().substring(0, 100),
      soldierId: soldierId?.toString().substring(0, 100),
      accountId: accountId?.toString().substring(0, 100),
      timestamp: new Date().toISOString(),
      source: req.greenRoute?.source || 'unknown',
      verified: req.greenRoute?.verified || false
    };
    
    // Log metrics (could be stored in DB for analytics)
    logger.info('[Green Route IAI Metrics]', sanitizedData);
    
    // Update soldier heartbeat if soldierId provided
    if (sanitizedData.soldierId && sanitizedData.accountId) {
      try {
        await prisma.iAISoldier.updateMany({
          where: { soldierId: sanitizedData.soldierId },
          data: {
            lastHeartbeatAt: new Date(),
            status: 'ONLINE'
          }
        });
      } catch {
        // Silently fail - metrics logging shouldn't break if soldier update fails
      }
    }
    
    res.json({ 
      success: true, 
      recorded: true,
      timestamp: sanitizedData.timestamp
    });
  } catch (error) {
    logger.error('[Green Route IAI Metrics] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to record metrics' 
    });
  }
});

/**
 * POST /api/green/fbm-posts/update
 * Update FBM post logs from IAI soldiers
 * 
 * SECURITY: Validates logId format and update fields
 */
router.post('/fbm-posts/update', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const accountUser = (req as any).accountUser;
    const { logId, status, stage, errorCode, errorMessage, fbPostId, success } = req.body;
    
    // Validate logId format (UUID)
    if (!logId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(logId)) {
      res.status(400).json({ 
        success: false, 
        error: 'Invalid logId format' 
      });
      return;
    }
    
    // Validate status if provided
    const validStatuses = ['initiated', 'queued', 'processing', 'completed', 'failed', 'cancelled'];
    if (status && !validStatuses.includes(status)) {
      res.status(400).json({ 
        success: false, 
        error: 'Invalid status',
        validStatuses
      });
      return;
    }
    
    // Verify log belongs to user's account
    const existingLog = await prisma.fBMPostLog.findFirst({
      where: {
        id: logId,
        accountId: accountUser?.accountId
      }
    });
    
    if (!existingLog) {
      res.status(404).json({ 
        success: false, 
        error: 'FBM Post Log not found or access denied' 
      });
      return;
    }
    
    // Build update data with sanitization
    const updateData: any = {
      updatedAt: new Date()
    };
    
    if (status) updateData.status = status;
    if (stage) updateData.stage = stage.toString().substring(0, 50);
    if (errorCode) updateData.errorCode = errorCode.toString().substring(0, 50);
    if (errorMessage) updateData.errorMessage = errorMessage.toString().substring(0, 1000);
    if (fbPostId) updateData.fbPostId = fbPostId.toString().substring(0, 100);
    if (typeof success === 'boolean') updateData.success = success;
    if (status === 'completed') updateData.completedAt = new Date();
    
    // Update the log
    const updatedLog = await prisma.fBMPostLog.update({
      where: { id: logId },
      data: updateData
    });
    
    logger.info('[Green FBM Update]', {
      logId,
      status: updatedLog.status,
      stage: updatedLog.stage,
      userId: user?.id,
      verified: req.greenRoute?.verified
    });
    
    res.json({
      success: true,
      log: {
        id: updatedLog.id,
        status: updatedLog.status,
        stage: updatedLog.stage
      }
    });
  } catch (error) {
    logger.error('[Green FBM Update] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update FBM post log' 
    });
  }
});

/**
 * POST /api/green/fbm-posts/event
 * Add event to FBM post log from IAI soldiers
 * 
 * SECURITY: Validates event data and ownership
 */
router.post('/fbm-posts/event', async (req: Request, res: Response): Promise<void> => {
  try {
    const accountUser = (req as any).accountUser;
    const { logId, eventType, stage, message, source, details } = req.body;
    
    // Validate logId format (UUID)
    if (!logId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(logId)) {
      res.status(400).json({ 
        success: false, 
        error: 'Invalid logId format' 
      });
      return;
    }
    
    // Validate required fields
    if (!eventType || !stage || !message) {
      res.status(400).json({ 
        success: false, 
        error: 'eventType, stage, and message are required' 
      });
      return;
    }
    
    // Validate event type
    const validEventTypes = ['info', 'warning', 'error', 'success', 'debug'];
    if (!validEventTypes.includes(eventType)) {
      res.status(400).json({ 
        success: false, 
        error: 'Invalid eventType',
        validTypes: validEventTypes
      });
      return;
    }
    
    // Verify log belongs to user's account
    const existingLog = await prisma.fBMPostLog.findFirst({
      where: {
        id: logId,
        accountId: accountUser?.accountId
      }
    });
    
    if (!existingLog) {
      res.status(404).json({ 
        success: false, 
        error: 'FBM Post Log not found or access denied' 
      });
      return;
    }
    
    // Create sanitized event
    const event = await prisma.fBMPostEvent.create({
      data: {
        postLogId: logId,
        eventType,
        stage: stage.toString().substring(0, 50),
        message: message.toString().substring(0, 1000),
        source: (source || 'green_route').toString().substring(0, 50),
        details: details || undefined,
        timestamp: new Date()
      }
    });
    
    res.json({
      success: true,
      event: {
        id: event.id,
        eventType: event.eventType,
        stage: event.stage
      }
    });
  } catch (error) {
    logger.error('[Green FBM Event] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to add FBM event' 
    });
  }
});

export default router;
