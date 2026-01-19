/**
 * Cloud Routes - AI Sales Assistant Endpoints
 * 
 * These are PUBLIC endpoints (no authentication required)
 * for potential customers to interact with Cloud
 */

import { Router } from 'express';
import { body } from 'express-validator';
import { CloudController } from '@/controllers/cloud.controller';
import { asyncHandler } from '@/utils/asyncHandler';
import { validate } from '@/middleware/validation';
import rateLimit from 'express-rate-limit';

const router = Router();
const controller = new CloudController();

// Rate limiting for public endpoints
const cloudRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: { success: false, error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all Cloud routes
router.use(cloudRateLimit);

/**
 * @route   POST /api/cloud/chat
 * @desc    Chat with Cloud AI assistant
 * @access  Public
 */
router.post(
  '/chat',
  validate([
    body('message').isString().notEmpty().withMessage('Message is required'),
    body('message').isLength({ max: 1000 }).withMessage('Message too long'),
    body('conversationHistory').optional().isArray(),
    body('sessionId').optional().isString(),
  ]),
  asyncHandler(controller.chat.bind(controller))
);

/**
 * @route   GET /api/cloud/product-info
 * @desc    Get product information
 * @access  Public
 */
router.get(
  '/product-info',
  asyncHandler(controller.getProductInfo.bind(controller))
);

/**
 * @route   GET /api/cloud/faq
 * @desc    Get frequently asked questions
 * @access  Public
 */
router.get(
  '/faq',
  asyncHandler(controller.getFaq.bind(controller))
);

/**
 * @route   GET /api/cloud/status
 * @desc    Get Cloud's status
 * @access  Public
 */
router.get(
  '/status',
  asyncHandler(controller.getStatus.bind(controller))
);

export default router;
