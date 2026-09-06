import { Router } from 'express';
import * as adminController from '../controllers/admin.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorizeRoles } from '../middleware/role.middleware';

const router = Router();

router.use(authenticate);
router.use(authorizeRoles('ADMIN'));

// Dashboard
router.get('/dashboard', adminController.getDashboard);
router.get('/live-buses', adminController.getLiveBuses);
router.get('/active-trips', adminController.getActiveTrips);
router.get('/statistics', adminController.getStatistics);

// Fake GPS Controls (support both /fake-gps/start/:busId and /fake-gps/:busId/start)
router.post('/fake-gps/start/:busId', adminController.startFakeGps);
router.post('/fake-gps/:busId/start', adminController.startFakeGps);
router.post('/fake-gps/pause/:busId', adminController.pauseFakeGps);
router.post('/fake-gps/:busId/pause', adminController.pauseFakeGps);
router.post('/fake-gps/resume/:busId', adminController.resumeFakeGps);
router.post('/fake-gps/:busId/resume', adminController.resumeFakeGps);
router.post('/fake-gps/stop/:busId', adminController.stopFakeGps);
router.post('/fake-gps/:busId/stop', adminController.stopFakeGps);
router.post('/fake-gps/speed/:busId', adminController.setFakeGpsSpeed);
router.post('/fake-gps/:busId/speed', adminController.setFakeGpsSpeed);
router.get('/fake-gps/status/:busId', adminController.getFakeGpsStatus);
router.get('/fake-gps/:busId/status', adminController.getFakeGpsStatus);
router.post('/fake-gps/start-all', adminController.startAllFakeGps);
router.post('/fake-gps/stop-all', adminController.stopAllFakeGps);

export default router;
