import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate } from '@/middleware/auth';
import { VehicleController } from '@/controllers/vehicle.controller';
import { asyncHandler } from '@/utils/asyncHandler';
import { validate, vehicleValidators } from '@/middleware/validation';

const router = Router();
const controller = new VehicleController();

// All vehicle routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/vehicles
 * @desc    Get all vehicles for account
 * @access  Private
 */
router.get(
  '/',
  validate(vehicleValidators.list),
  asyncHandler(controller.getVehicles.bind(controller))
);

/**
 * @route   GET /api/vehicles/:id
 * @desc    Get single vehicle
 * @access  Private
 */
router.get(
  '/:id',
  validate(vehicleValidators.getById),
  asyncHandler(controller.getVehicle.bind(controller))
);

/**
 * @route   POST /api/vehicles
 * @desc    Create vehicle
 * @access  Private
 */
router.post(
  '/',
  validate(vehicleValidators.create),
  asyncHandler(controller.createVehicle.bind(controller))
);

/**
 * @route   PUT /api/vehicles/:id
 * @desc    Update vehicle
 * @access  Private
 */
router.put(
  '/:id',
  validate(vehicleValidators.update),
  asyncHandler(controller.updateVehicle.bind(controller))
);

/**
 * @route   DELETE /api/vehicles/:id
 * @desc    Delete vehicle
 * @access  Private
 */
router.delete(
  '/:id',
  validate([param('id').isUUID().withMessage('Invalid vehicle ID')]),
  asyncHandler(controller.deleteVehicle.bind(controller))
);

/**
 * @route   POST /api/vehicles/bulk/status
 * @desc    Bulk update vehicle status
 * @access  Private
 */
router.post(
  '/bulk/status',
  validate([
    body('vehicleIds').isArray({ min: 1, max: 100 }).withMessage('1-100 vehicle IDs required'),
    body('vehicleIds.*').isUUID().withMessage('Invalid vehicle ID'),
    body('status').isIn(['ACTIVE', 'SOLD', 'PENDING', 'INACTIVE']).withMessage('Invalid status'),
    body('accountId').isUUID().withMessage('Invalid account ID'),
  ]),
  asyncHandler(controller.bulkUpdateStatus.bind(controller))
);

/**
 * @route   POST /api/vehicles/:id/refresh-from-source
 * @desc    Refresh vehicle data from FTP/CSV source
 * @access  Private
 */
router.post(
  '/:id/refresh-from-source',
  validate([
    param('id').isUUID().withMessage('Invalid vehicle ID'),
  ]),
  asyncHandler(controller.refreshFromSource.bind(controller))
);

/**
 * @route   POST /api/vehicles/:id/post-to-facebook
 * @desc    Post vehicle to Facebook via IAI/API/Soldier
 * @access  Private
 */
router.post(
  '/:id/post-to-facebook',
  validate([
    param('id').isUUID().withMessage('Invalid vehicle ID'),
    body('title').isString().notEmpty().withMessage('Title is required'),
    body('price').isNumeric().withMessage('Price must be a number'),
    body('description').isString().notEmpty().withMessage('Description is required'),
    body('photos').isArray().withMessage('Photos must be an array'),
    body('method').isIn(['iai', 'api', 'soldier']).withMessage('Invalid posting method. Use: iai, api, or soldier'),
    body('includePixelTracking').optional().isBoolean().withMessage('includePixelTracking must be a boolean'),
  ]),
  asyncHandler(controller.postToFacebook.bind(controller))
);

/**
 * @route   GET /api/vehicles/tasks/:taskId
 * @desc    Get posting task status
 * @access  Private
 */
router.get(
  '/tasks/:taskId',
  validate([
    param('taskId').isUUID().withMessage('Invalid task ID'),
  ]),
  asyncHandler(controller.getPostingTaskStatus.bind(controller))
);

/**
 * @route   GET /api/vehicles/tasks
 * @desc    Get pending tasks for extension
 * @access  Private
 */
router.get(
  '/tasks',
  asyncHandler(controller.getPendingTasks.bind(controller))
);

export default router;
