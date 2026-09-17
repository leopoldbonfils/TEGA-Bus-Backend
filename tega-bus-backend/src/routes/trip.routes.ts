import { Router } from 'express';
import * as tripController from '../controllers/trip.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorizeRoles } from '../middleware/role.middleware';

const router = Router();

// Public / Passenger read routes
router.get('/active', tripController.getActiveTrips);
router.get('/', tripController.getAllTrips);
router.get('/:id', tripController.getTripById);

// Protected routes (Driver only)
router.use(authenticate);
router.post('/start', authorizeRoles('DRIVER'), tripController.startTrip);
router.post('/:id/end', authorizeRoles('DRIVER'), tripController.endTrip);

export default router;
