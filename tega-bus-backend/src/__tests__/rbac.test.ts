import request from 'supertest';
import app from '../app';
import prisma from '../config/database';
import { hashPassword } from '../utils/password';
import { signToken } from '../utils/jwt';
import { Role } from '@prisma/client';

describe('Authorization (RBAC)', () => {
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
  });

  describe('Passenger restrictions', () => {
    it('cannot access admin dashboard', async () => {
      const res = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${passengerToken}`);
      expect(res.status).toBe(403);
    });

    it('cannot start a trip', async () => {
      const res = await request(app)
        .post('/api/trips/start')
        .set('Authorization', `Bearer ${passengerToken}`);
      expect(res.status).toBe(403);
    });

    it('can view routes', async () => {
      const res = await request(app)
        .get('/api/routes')
        .set('Authorization', `Bearer ${passengerToken}`);
      expect(res.status).toBe(200);
    });

    it('cannot create a route', async () => {
      const res = await request(app)
        .post('/api/routes')
        .set('Authorization', `Bearer ${passengerToken}`)
        .send({ name: 'Hack', startLocation: 'A', destination: 'B', fare: 100, estimatedDuration: 10 });
      expect(res.status).toBe(403);
    });
  });

  describe('Driver restrictions', () => {
    it('cannot access admin dashboard', async () => {
      const res = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${driverToken}`);
      expect(res.status).toBe(403);
    });

    it('cannot create a bus', async () => {
      const res = await request(app)
        .post('/api/buses')
        .set('Authorization', `Bearer ${driverToken}`)
        .send({ busNumber: 'X', plateNumber: 'Y', capacity: 30 });
      expect(res.status).toBe(403);
    });
  });

  describe('Admin access', () => {
    it('can access admin dashboard', async () => {
      const res = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.statistics).toBeDefined();
    });

    it('can access all users', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });
  });
});
