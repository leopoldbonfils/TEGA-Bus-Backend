import { Router } from 'express';
import * as busController from '../controllers/bus.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorizeRoles } from '../middleware/role.middleware';

const router = Router();

// Public routes (no auth required)
router.get('/active', busController.getActiveBuses);
router.get('/nearby', busController.getNearbyBuses);
router.get('/upcoming-trip', busController.getUpcomingTrip);

router.use(authenticate);

// Authenticated user routes
router.get('/', busController.getAllBuses);
router.get('/:id', busController.getBusById);
router.get('/:id/location', busController.getBusLocation);
router.get('/:id/location/history', busController.getBusLocationHistory);

// Admin only
router.post('/', authorizeRoles('ADMIN'), busController.createBus);
router.put('/:id', authorizeRoles('ADMIN'), busController.updateBus);
router.delete('/:id', authorizeRoles('ADMIN'), busController.deleteBus);

export default router;
