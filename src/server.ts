import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
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
  createSecureGateway,
  ring5AuthBarrier,
} from '@/middleware/apiGateway';
import { logger } from '@/utils/logger';
import prisma from '@/config/database';
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
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: [
        "'self'",
        "https://graph.facebook.com",
        "https://fmd-production.up.railway.app",
        "https://dealersface.com",
        "https://www.dealersface.com"
      ],
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
// CORS Configuration
// ============================================
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173', // Vite dev server
  ...(process.env.ALLOWED_ORIGINS?.split(',') || []),
  process.env.API_URL,
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked request from origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
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
app.use('/api/vehicles', ring5AuthBarrier, vehicleRoutes);                     // Requires auth
app.use('/api/accounts', ring5AuthBarrier, accountRoutes);                     // Requires auth
app.use('/api/facebook', ring5AuthBarrier, facebookRoutes);                    // Requires auth
app.use('/api/sync', ring5AuthBarrier, syncRoutes);                            // Requires auth
app.use('/api/users/me', ring5AuthBarrier, userCredentialsRoutes);             // Requires auth
app.use('/api/users/me/api-keys', ring5AuthBarrier, require('./routes/apiKey.routes').default);
app.use('/api/subscriptions', require('./routes/subscription.routes').default); // Mixed (webhook is public)
app.use('/api/admin', ring5AuthBarrier, require('./routes/admin.routes').default); // Requires admin
app.use('/api/email', ring5AuthBarrier, emailRoutes);                          // Requires auth
app.use('/api/leads', ring5AuthBarrier, require('./routes/lead.routes').default); // Requires auth

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

    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
      logger.info(`📡 Health check available at: http://localhost:${PORT}/health`);
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
  await shutdownEmailQueue();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  schedulerService.shutdown();
  await shutdownEmailQueue();
  process.exit(0);
});

startServer();

export default app;
