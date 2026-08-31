import { Router } from 'express';
import * as driverController from '../controllers/driver.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorizeRoles } from '../middleware/role.middleware';

const router = Router();

router.use(authenticate);

// Driver self-service
router.get('/me', authorizeRoles('DRIVER'), driverController.getMyDriverProfile);
router.get('/me/trips', authorizeRoles('DRIVER'), driverController.getMyTrips);

// Admin only
router.get('/', authorizeRoles('ADMIN'), driverController.getAllDrivers);
router.get('/:id', authorizeRoles('ADMIN', 'DRIVER'), driverController.getDriverById);
router.post('/', authorizeRoles('ADMIN'), driverController.createDriver);
router.put('/:id', authorizeRoles('ADMIN', 'DRIVER'), driverController.updateDriver);

export default router;
