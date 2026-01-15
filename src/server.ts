import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { errorHandler } from '@/middleware/errorHandler';
import { logger } from '@/utils/logger';
import authRoutes from '@/routes/auth.routes';
import vehicleRoutes from '@/routes/vehicle.routes';
import accountRoutes from '@/routes/account.routes';
import facebookRoutes from '@/routes/facebook.routes';
import syncRoutes from '@/routes/sync.routes';
import userCredentialsRoutes from '@/routes/userCredentials.routes';
import { initializeQueueProcessor } from '@/jobs/queueProcessor';
import { schedulerService } from '@/services/scheduler.service';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;

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

// ============================================
// 404 Handler
// ============================================
app.use('*', (_req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
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
    // Initialize background job processor
    await initializeQueueProcessor();
    logger.info('✅ Queue processor initialized');

    // Initialize auto-sync scheduler
    schedulerService.initialize();
    logger.info('✅ Auto-sync scheduler initialized');

    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  schedulerService.shutdown();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  schedulerService.shutdown();
  process.exit(0);
});

startServer();

export default app;
