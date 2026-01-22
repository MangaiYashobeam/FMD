import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';

// Auth request type for user extraction
interface AuthRequest extends Request {
  user?: { id: string; email?: string };
}

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: AuthRequest,
  res: Response,
  _next: NextFunction
) => {
  let statusCode = 500;
  let message = 'Internal Server Error';

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  }

  // Log error to console
  logger.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    statusCode,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  // Log error to Error Monitoring System for AI intervention
  logErrorToMonitoring(req, err, statusCode).catch((e) => {
    logger.warn('Failed to log error to monitoring:', e);
  });

  // Send error response
  res.status(statusCode).json({
    success: false,
    message,
    error: message, // Add error field for frontend compatibility
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: err,
    }),
  });
};

/**
 * Log error to the Error Monitoring Service for AI analysis
 */
async function logErrorToMonitoring(req: AuthRequest, err: Error | AppError, statusCode: number) {
  try {
    // Only import if needed (lazy load to avoid circular deps)
    const { errorMonitoringService } = await import('@/services/error-monitoring.service');
    
    // Determine severity based on status code
    let severity: 'WARNING' | 'ERROR' | 'CRITICAL' | 'FATAL' = 'ERROR';
    if (statusCode >= 500) {
      severity = statusCode === 503 ? 'CRITICAL' : 'ERROR';
    } else if (statusCode === 401 || statusCode === 403) {
      severity = 'WARNING';
    } else if (statusCode === 404) {
      severity = 'WARNING'; // Don't escalate 404s
    }
    
    // Don't log repeated auth failures (too noisy)
    if (statusCode === 401 && err.message === 'Invalid token') {
      return; // Skip noisy auth failures
    }

    // Extract user info if available
    const userId = req.user?.id || 'anonymous';
    const sessionToken = req.headers.authorization?.replace('Bearer ', '') || 'no-token';
    
    // Determine error type
    let errorType = 'SERVER_ERROR';
    if (statusCode === 400) errorType = 'VALIDATION_ERROR';
    else if (statusCode === 401) errorType = 'AUTH_ERROR';
    else if (statusCode === 403) errorType = 'PERMISSION_ERROR';
    else if (statusCode === 404) errorType = 'NOT_FOUND';
    else if (statusCode === 429) errorType = 'RATE_LIMIT';
    else if (statusCode >= 500) errorType = 'SERVER_ERROR';
    
    await errorMonitoringService.logError({
      userId,
      sessionToken: sessionToken.substring(0, 50), // Truncate for storage
      errorType,
      errorCode: `HTTP_${statusCode}`,
      errorMessage: err.message,
      stackTrace: err.stack,
      endpoint: req.path,
      httpMethod: req.method,
      httpStatus: statusCode,
      requestPayload: req.body && Object.keys(req.body).length > 0 
        ? JSON.stringify(req.body).substring(0, 500) 
        : undefined,
      userAction: `${req.method} ${req.path}`,
      pageUrl: req.headers.referer || req.headers.origin || 'API',
      severity,
    });

    logger.debug(`Error logged to monitoring: ${errorType} (${statusCode}) - ${err.message}`);
  } catch (error) {
    // Don't let monitoring failures break the error handler
    logger.warn('Error monitoring logging failed:', error);
  }
}

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
