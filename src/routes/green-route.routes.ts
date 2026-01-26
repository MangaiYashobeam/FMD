/**
 * ============================================
 * FaceMyDealer - Green Route API
 * ============================================
 * 
 * Secure internal API endpoints that work during mitigation
 * - All requests are logged and tracked
 * - Only accessible by verified ecosystem clients
 * - Bypasses public route restrictions
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { setAccountContext } from '../middleware/account.middleware';
import { greenRouteVerify, greenRouteLogger } from '../middleware/green-route.middleware';
import prisma from '../config/database';

const router = Router();

// Apply Green Route verification to all routes
router.use(greenRouteVerify);
router.use(greenRouteLogger);

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
 */
router.post('/heartbeat', async (req, res) => {
  try {
    const user = (req as any).user;
    const { browserInfo } = req.body;
    // extensionVersion and activeTab reserved for future analytics

    // Update user's last active timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastActiveAt: new Date(),
        lastUserAgent: browserInfo?.userAgent
      }
    });

    res.json({
      success: true,
      ack: true,
      serverTime: new Date().toISOString()
    });
  } catch (error: any) {
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

export default router;
