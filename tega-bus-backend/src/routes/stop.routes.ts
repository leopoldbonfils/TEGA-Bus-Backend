import { Router } from 'express';
import * as stopController from '../controllers/stop.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorizeRoles } from '../middleware/role.middleware';

const router = Router();

// Public routes (no auth required)
router.get('/nearby', stopController.getNearbyStops);

router.use(authenticate);

// Authenticated user routes
router.get('/', stopController.getAllStops);
router.get('/:id', stopController.getStopById);

// Admin only
router.post('/', authorizeRoles('ADMIN'), stopController.createStop);
router.put('/:id', authorizeRoles('ADMIN'), stopController.updateStop);
router.delete('/:id', authorizeRoles('ADMIN'), stopController.deleteStop);

export default router;
