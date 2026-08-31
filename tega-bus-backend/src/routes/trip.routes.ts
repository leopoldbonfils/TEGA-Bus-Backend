import { Router } from 'express';
import * as tripController from '../controllers/trip.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorizeRoles } from '../middleware/role.middleware';

const router = Router();

router.use(authenticate);

// All authenticated
router.get('/active', tripController.getActiveTrips);
router.get('/', authorizeRoles('ADMIN', 'DRIVER'), tripController.getAllTrips);
router.get('/:id', authorizeRoles('ADMIN', 'DRIVER'), tripController.getTripById);

// Driver only
router.post('/start', authorizeRoles('DRIVER'), tripController.startTrip);
router.post('/:id/end', authorizeRoles('DRIVER'), tripController.endTrip);

export default router;
