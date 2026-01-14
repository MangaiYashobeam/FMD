import { Router } from 'express';
import { authenticate } from '@/middleware/auth';
import { VehicleController } from '@/controllers/vehicle.controller';
import { asyncHandler } from '@/utils/asyncHandler';

const router = Router();
const controller = new VehicleController();

// All vehicle routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/vehicles
 * @desc    Get all vehicles for account
 * @access  Private
 */
router.get('/', asyncHandler(controller.getVehicles.bind(controller)));

/**
 * @route   GET /api/vehicles/:id
 * @desc    Get single vehicle
 * @access  Private
 */
router.get('/:id', asyncHandler(controller.getVehicle.bind(controller)));

/**
 * @route   POST /api/vehicles
 * @desc    Create vehicle
 * @access  Private
 */
router.post('/', asyncHandler(controller.createVehicle.bind(controller)));

/**
 * @route   PUT /api/vehicles/:id
 * @desc    Update vehicle
 * @access  Private
 */
router.put('/:id', asyncHandler(controller.updateVehicle.bind(controller)));

/**
 * @route   DELETE /api/vehicles/:id
 * @desc    Delete vehicle
 * @access  Private
 */
router.delete('/:id', asyncHandler(controller.deleteVehicle.bind(controller)));

/**
 * @route   POST /api/vehicles/bulk/status
 * @desc    Bulk update vehicle status
 * @access  Private
 */
router.post('/bulk/status', asyncHandler(controller.bulkUpdateStatus.bind(controller)));

export default router;
