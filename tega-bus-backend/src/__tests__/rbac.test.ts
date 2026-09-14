import request from 'supertest';
import app from '../app';
import prisma from '../config/database';
import { hashPassword } from '../utils/password';
import { signToken } from '../utils/jwt';
import { Role } from '@prisma/client';

describe('Role-Based Access Control (RBAC) Tests', () => {
  let adminToken: string;
  let driverToken: string;
  let passengerToken: string;

  beforeAll(async () => {
    const pw = await hashPassword('Test1234!');

    const [admin, driver, passenger] = await Promise.all([
      prisma.user.create({
        data: { name: 'Test Admin', email: `rbac_admin+${Date.now()}@test.com`, password: pw, role: Role.ADMIN },
      }),
      prisma.user.create({
        data: { name: 'Test Driver', email: `rbac_driver+${Date.now()}@test.com`, password: pw, role: Role.DRIVER },
      }),
      prisma.user.create({
        data: { name: 'Test Passenger', email: `rbac_pass+${Date.now()}@test.com`, password: pw, role: Role.PASSENGER },
      }),
    ]);

    adminToken = signToken({ userId: admin.id, role: admin.role });
    driverToken = signToken({ userId: driver.id, role: driver.role });
    passengerToken = signToken({ userId: passenger.id, role: passenger.role });
  }, 30000);

  describe('Passenger Role Permissions', () => {
    test('passenger cannot access admin features', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${passengerToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    test('passenger cannot start a trip', async () => {
      const response = await request(app)
        .post('/api/trips/start')
        .set('Authorization', `Bearer ${passengerToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    test('passenger can view routes', async () => {
      const response = await request(app)
        .get('/api/routes')
        .set('Authorization', `Bearer ${passengerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('passenger cannot create route', async () => {
      const response = await request(app)
        .post('/api/routes')
        .set('Authorization', `Bearer ${passengerToken}`)
        .send({ name: 'Hack Route', startLocation: 'A', destination: 'B', fare: 100, estimatedDuration: 10 });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Driver Role Permissions', () => {
    test('driver cannot access admin features', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${driverToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    test('driver cannot create bus', async () => {
      const response = await request(app)
        .post('/api/buses')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ busNumber: 'X', plateNumber: 'Y', capacity: 30 });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Admin Role Permissions', () => {
    test('admin can access admin dashboard', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.statistics).toBeDefined();
    });

    test('admin can access users', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});

