import { Router } from 'express';
import * as locationController from '../controllers/location.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorizeRoles } from '../middleware/role.middleware';

const router = Router();

router.use(authenticate);

// Driver sends location update
router.post('/', authorizeRoles('DRIVER', 'ADMIN'), locationController.createLocation);

export default router;
