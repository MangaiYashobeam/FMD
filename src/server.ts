import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import path from 'path';

// Load environment variables first
dotenv.config();

// Early logging to track startup progress
console.log('🔵 Starting FaceMyDealer server...');
console.log('🔵 Environment:', process.env.NODE_ENV);
console.log('🔵 Port:', process.env.PORT || 3000);
console.log('🔵 Loading modules...');

import { errorHandler } from '@/middleware/errorHandler';
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
// Security Middleware
// ============================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// ============================================
// CORS Configuration
// ============================================
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// ============================================
// Rate Limiting
// ============================================
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// ============================================
// Body Parsing
// ============================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// Request Logging
// ============================================
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// ============================================
// Health Check
// ============================================
// Root route
// ============================================
app.get('/', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'FaceMyDealer API',
    version: '1.0.0',
    status: 'online',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      vehicles: '/api/vehicles',
      accounts: '/api/accounts',
      facebook: '/api/facebook',
      sync: '/api/sync',
      admin: '/api/admin',
    },
    documentation: 'https://github.com/MangaiYashobeam/FMD',
  });
});

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ============================================
// API Routes
// ============================================
app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/facebook', facebookRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/users/me', userCredentialsRoutes);
app.use('/api/subscriptions', require('./routes/subscription.routes').default);
app.use('/api/admin', require('./routes/admin.routes').default);
app.use('/api/email', emailRoutes);

// ============================================
// Serve React Frontend (Static Files)
// ============================================
const webDistPath = path.join(__dirname, '../web/dist');
app.use(express.static(webDistPath));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res, next) => {
  // Skip API routes
  if (req.path.startsWith('/api/') || req.path === '/health') {
    return next();
  }
  res.sendFile(path.join(webDistPath, 'index.html'), (err) => {
    if (err) {
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
