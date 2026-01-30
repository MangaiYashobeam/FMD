import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult, ValidationChain } from 'express-validator';

/**
 * Validation Middleware
 * Centralized input validation and sanitization for production security
 */

// ============================================
// Validation Result Handler
// ============================================
export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Run all validations
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const messages = errors.array().map(err => {
        // Don't expose internal field names in production
        if (process.env.NODE_ENV === 'production') {
          return 'Invalid input provided';
        }
        return `${(err as any).path}: ${err.msg}`;
      });

      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: messages,
      });
      return;
    }
    next();
  };
};

// Custom sanitizer to remove dangerous characters
const removeDangerous = (value: string): string => {
  if (typeof value !== 'string') return value;
  // Remove null bytes, control characters, and potential SQL/NoSQL injection chars
  return value
    .replace(/\0/g, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/[<>]/g, '');
};

// ============================================
// Auth Validators
// ============================================
export const authValidators = {
  register: [
    body('email')
      .isEmail()
      .withMessage('Valid email is required')
      .normalizeEmail({ gmail_remove_dots: false })
      .isLength({ max: 255 })
      .withMessage('Email too long'),
    body('password')
      .isLength({ min: 8, max: 128 })
      .withMessage('Password must be 8-128 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase, and number'),
    body('firstName')
      .trim()
      .notEmpty()
      .withMessage('First name is required')
      .isLength({ max: 100 })
      .withMessage('First name too long')
      .customSanitizer(removeDangerous),
    body('lastName')
      .trim()
      .notEmpty()
      .withMessage('Last name is required')
      .isLength({ max: 100 })
      .withMessage('Last name too long')
      .customSanitizer(removeDangerous),
    body('accountName')
      .trim()
      .notEmpty()
      .withMessage('Account name is required')
      .isLength({ max: 200 })
      .withMessage('Account name too long')
      .customSanitizer(removeDangerous),
  ],

  login: [
    body('email')
      .isEmail()
      .withMessage('Valid email is required')
      .normalizeEmail({ gmail_remove_dots: false }),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
      .isLength({ max: 128 })
      .withMessage('Invalid password'),
  ],

  forgotPassword: [
    body('email')
      .isEmail()
      .withMessage('Valid email is required')
      .normalizeEmail({ gmail_remove_dots: false }),
  ],

  resetPassword: [
    body('token')
      .notEmpty()
      .withMessage('Reset token is required')
      .isLength({ min: 32, max: 128 })
      .withMessage('Invalid reset token')
      .isAlphanumeric()
      .withMessage('Invalid token format'),
    body('password')
      .isLength({ min: 8, max: 128 })
      .withMessage('Password must be 8-128 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase, and number'),
  ],

  refreshToken: [
    body('refreshToken')
      .notEmpty()
      .withMessage('Refresh token is required')
      .isJWT()
      .withMessage('Invalid token format'),
  ],
};

// ============================================
// Vehicle Validators
// ============================================
export const vehicleValidators = {
  create: [
    body('accountId')
      .notEmpty()
      .withMessage('Account ID is required')
      .isUUID()
      .withMessage('Invalid account ID format'),
    body('vin')
      .optional()
      .trim()
      .isLength({ min: 17, max: 17 })
      .withMessage('VIN must be 17 characters')
      .isAlphanumeric()
      .withMessage('Invalid VIN format')
      .toUpperCase(),
    body('stockNumber')
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage('Stock number too long')
      .customSanitizer(removeDangerous),
    body('year')
      .optional()
      .isInt({ min: 1900, max: new Date().getFullYear() + 2 })
      .withMessage('Invalid year'),
    body('make')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Make too long')
      .customSanitizer(removeDangerous),
    body('model')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Model too long')
      .customSanitizer(removeDangerous),
    body('trim')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Trim too long')
      .customSanitizer(removeDangerous),
    body('price')
      .optional()
      .isFloat({ min: 0, max: 10000000 })
      .withMessage('Invalid price'),
    body('mileage')
      .optional()
      .isInt({ min: 0, max: 2000000 })
      .withMessage('Invalid mileage'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 5000 })
      .withMessage('Description too long')
      .customSanitizer(removeDangerous),
    body('imageUrls')
      .optional()
      .isArray({ max: 50 })
      .withMessage('Too many images'),
    body('imageUrls.*')
      .optional()
      .isURL({ protocols: ['http', 'https'] })
      .withMessage('Invalid image URL'),
  ],

  update: [
    param('id')
      .isUUID()
      .withMessage('Invalid vehicle ID'),
    body('vin')
      .optional()
      .trim()
      .isLength({ min: 17, max: 17 })
      .withMessage('VIN must be 17 characters')
      .isAlphanumeric()
      .withMessage('Invalid VIN format')
      .toUpperCase(),
    body('stockNumber')
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage('Stock number too long')
      .customSanitizer(removeDangerous),
    body('year')
      .optional()
      .isInt({ min: 1900, max: new Date().getFullYear() + 2 })
      .withMessage('Invalid year'),
    body('price')
      .optional()
      .isFloat({ min: 0, max: 10000000 })
      .withMessage('Invalid price'),
    body('mileage')
      .optional()
      .isInt({ min: 0, max: 2000000 })
      .withMessage('Invalid mileage'),
  ],

  getById: [
    param('id')
      .isUUID()
      .withMessage('Invalid vehicle ID'),
  ],

  list: [
    query('accountId')
      .optional() // Optional - controller auto-detects from user's account if not provided
      .isUUID()
      .withMessage('Invalid account ID'),
    query('page')
      .optional()
      .isInt({ min: 1, max: 10000 })
      .withMessage('Invalid page number'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be 1-100'),
  ],
};

// ============================================
// Account Validators
// ============================================
export const accountValidators = {
  getById: [
    param('id')
      .isUUID()
      .withMessage('Invalid account ID'),
  ],

  updateSettings: [
    param('id')
      .isUUID()
      .withMessage('Invalid account ID'),
    body('ftpHost')
      .optional()
      .trim()
      .isLength({ max: 255 })
      .withMessage('FTP host too long')
      .customSanitizer(removeDangerous),
    body('ftpPort')
      .optional()
      .isInt({ min: 1, max: 65535 })
      .withMessage('Invalid FTP port'),
    body('ftpUsername')
      .optional()
      .trim()
      .isLength({ max: 255 })
      .withMessage('FTP username too long')
      .customSanitizer(removeDangerous),
    body('ftpPassword')
      .optional()
      .isLength({ max: 500 })
      .withMessage('FTP password too long'),
    body('csvPath')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('CSV path too long')
      .customSanitizer(removeDangerous),
    body('autoSync')
      .optional()
      .isBoolean()
      .withMessage('autoSync must be boolean'),
    body('syncInterval')
      .optional()
      .isInt({ min: 15, max: 1440 })
      .withMessage('Sync interval must be 15-1440 minutes'),
  ],

  inviteUser: [
    param('id')
      .isUUID()
      .withMessage('Invalid account ID'),
    body('email')
      .isEmail()
      .withMessage('Valid email is required')
      .normalizeEmail({ gmail_remove_dots: false }),
    body('role')
      .isIn(['VIEWER', 'SALES_REP', 'ADMIN'])
      .withMessage('Invalid role'),
  ],
};

// ============================================
// Facebook Validators
// ============================================
export const facebookValidators = {
  getAuthUrl: [
    query('accountId')
      .optional()
      .isUUID()
      .withMessage('Invalid account ID'),
    query('returnUrl')
      .optional()
      .isString()
      .withMessage('Invalid return URL'),
  ],

  callback: [
    body('code')
      .notEmpty()
      .withMessage('Authorization code is required')
      .isLength({ max: 1000 })
      .withMessage('Invalid code'),
    body('state')
      .notEmpty()
      .withMessage('State is required')
      .isBase64()
      .withMessage('Invalid state format'),
  ],

  createPost: [
    body('vehicleId')
      .notEmpty()
      .withMessage('Vehicle ID is required')
      .isUUID()
      .withMessage('Invalid vehicle ID'),
    body('profileId')
      .notEmpty()
      .withMessage('Profile ID is required')
      .isUUID()
      .withMessage('Invalid profile ID'),
  ],

  getProfiles: [
    query('accountId')
      .optional()
      .isUUID()
      .withMessage('Invalid account ID'),
  ],
};

// ============================================
// Admin Validators
// ============================================
export const adminValidators = {
  getAllAccounts: [
    query('status')
      .optional()
      .isIn(['active', 'trialing', 'past_due', 'canceled', 'unpaid'])
      .withMessage('Invalid status'),
    query('search')
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Search term too long')
      .customSanitizer(removeDangerous),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be 1-100'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Invalid offset'),
  ],

  updateAccountStatus: [
    param('accountId')
      .isUUID()
      .withMessage('Invalid account ID'),
    body('isActive')
      .isBoolean()
      .withMessage('isActive must be boolean'),
    body('reason')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Reason too long')
      .customSanitizer(removeDangerous),
  ],

  getAllPayments: [
    query('status')
      .optional()
      .isIn(['succeeded', 'pending', 'failed', 'refunded'])
      .withMessage('Invalid status'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be 1-100'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Invalid offset'),
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Invalid start date format'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('Invalid end date format'),
  ],

  manageUser: [
    param('userId')
      .isUUID()
      .withMessage('Invalid user ID'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be boolean'),
    body('role')
      .optional()
      .isIn(['VIEWER', 'SALES_REP', 'ADMIN', 'ACCOUNT_OWNER', 'SUPER_ADMIN'])
      .withMessage('Invalid role'),
  ],
};

// ============================================
// Sync Validators
// ============================================
export const syncValidators = {
  trigger: [
    body('accountId')
      .notEmpty()
      .withMessage('Account ID is required')
      .isUUID()
      .withMessage('Invalid account ID'),
    body('type')
      .optional()
      .isIn(['ftp', 'api', 'manual'])
      .withMessage('Invalid sync type'),
  ],

  getStatus: [
    query('accountId')
      .notEmpty()
      .withMessage('Account ID is required')
      .isUUID()
      .withMessage('Invalid account ID'),
  ],
};

// ============================================
// UUID Validator Helper
// ============================================
export const validateUUID = (fieldName: string, location: 'param' | 'query' | 'body' = 'param') => {
  const validator = location === 'param' ? param : location === 'query' ? query : body;
  return validator(fieldName)
    .isUUID()
    .withMessage(`Invalid ${fieldName} format`);
};

// ============================================
// Pagination Validator Helper
// ============================================
export const paginationValidators = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage('Invalid page number')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be 1-100')
    .toInt(),
];

export default {
  validate,
  authValidators,
  vehicleValidators,
  accountValidators,
  facebookValidators,
  adminValidators,
  syncValidators,
  paginationValidators,
  validateUUID,
};
