import { Router } from 'express';
import { createAlert, getAlerts } from '../controllers/alert.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorizeRoles } from '../middleware/role.middleware';

const router = Router();

// GET /api/alerts authenticated (any role): passengers fetch their alerts
router.get('/', authenticate, getAlerts);

// POST /api/alerts  ADMIN only: create & broadcast an alert
router.post('/', authenticate, authorizeRoles('ADMIN'), createAlert);

export default router;
