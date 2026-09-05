import { Router } from 'express';
import * as routeController from '../controllers/route.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorizeRoles } from '../middleware/role.middleware';

const router = Router();

// Public routes (no auth required)
router.get('/search', routeController.searchRoutes);
router.get('/', routeController.getAllRoutes);
router.get('/:id', routeController.getRouteById);

router.use(authenticate);

// Admin only
router.post('/', authorizeRoles('ADMIN'), routeController.createRoute);
router.put('/:id', authorizeRoles('ADMIN'), routeController.updateRoute);
router.delete('/:id', authorizeRoles('ADMIN'), routeController.deleteRoute);

export default router;
