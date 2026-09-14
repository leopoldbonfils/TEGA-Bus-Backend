import request from 'supertest';
import app from '../app';
import prisma from '../config/database';
import { hashPassword } from '../utils/password';
import { signToken } from '../utils/jwt';
import { Role } from '@prisma/client';

describe('Bus & Route API Tests', () => {
  let adminToken: string;
  let passengerToken: string;
  let routeId: string;
  let busId: string;

  beforeAll(async () => {
    const pw = await hashPassword('Test1234!');
    const [admin, passenger] = await Promise.all([
      prisma.user.create({
        data: { name: 'Bus Admin', email: `bus_admin+${Date.now()}@test.com`, password: pw, role: Role.ADMIN },
      }),
      prisma.user.create({
        data: { name: 'Bus Passenger', email: `bus_pass+${Date.now()}@test.com`, password: pw, role: Role.PASSENGER },
      }),
    ]);
    adminToken = signToken({ userId: admin.id, role: admin.role });
    passengerToken = signToken({ userId: passenger.id, role: passenger.role });
  }, 30000);

  describe('Route Management', () => {
    test('admin can create route', async () => {
      const response = await request(app)
        .post('/api/routes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Route 999',
          startLocation: 'Start City',
          destination: 'End City',
          fare: 400,
          estimatedDuration: 30,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.route.name).toBe('Test Route 999');

      routeId = response.body.data.route.id;
    });

    test('users can view routes', async () => {
      const response = await request(app)
        .get('/api/routes')
        .set('Authorization', `Bearer ${passengerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.routes)).toBe(true);
    });

    test('users can search routes', async () => {
      const response = await request(app)
        .get('/api/routes/search?from=Start City')
        .set('Authorization', `Bearer ${passengerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.routes.length).toBeGreaterThan(0);
    });

    test('admin can update route', async () => {
      const response = await request(app)
        .put(`/api/routes/${routeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ fare: 500 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.route.fare).toBe(500);
    });
  });

  describe('Bus Management', () => {
    test('admin can create bus', async () => {
      const response = await request(app)
        .post('/api/buses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          busNumber: `TEST-${Date.now()}`,
          plateNumber: `RAB-${Date.now()}`,
          capacity: 40,
          routeId,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.bus.capacity).toBe(40);

      busId = response.body.data.bus.id;
    });

    test('users can view buses', async () => {
      const response = await request(app)
        .get('/api/buses')
        .set('Authorization', `Bearer ${passengerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('admin can update bus', async () => {
      const response = await request(app)
        .put(`/api/buses/${busId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'MAINTENANCE' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.bus.status).toBe('MAINTENANCE');
    });

    test('passenger cannot create bus', async () => {
      const response = await request(app)
        .post('/api/buses')
        .set('Authorization', `Bearer ${passengerToken}`)
        .send({ busNumber: 'HACK', plateNumber: 'HACK-1', capacity: 10 });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Location Data Validation', () => {
    test('invalid latitude is rejected', async () => {
      const response = await request(app)
        .post('/api/locations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ busId, latitude: 999, longitude: 30.0, speed: 20, heading: 90 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('invalid longitude is rejected', async () => {
      const response = await request(app)
        .post('/api/locations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ busId, latitude: -1.9, longitude: 999, speed: 20, heading: 90 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});

