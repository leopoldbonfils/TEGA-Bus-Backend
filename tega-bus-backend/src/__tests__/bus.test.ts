import request from 'supertest';
import app from '../app';
import prisma from '../config/database';
import { hashPassword } from '../utils/password';
import { signToken } from '../utils/jwt';
import { Role } from '@prisma/client';

describe('Bus & Route API', () => {
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
  });

  describe('Route CRUD', () => {
    it('admin can create a route', async () => {
      const res = await request(app)
        .post('/api/routes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Route 999',
          startLocation: 'Start City',
          destination: 'End City',
          fare: 400,
          estimatedDuration: 30,
        });
      expect(res.status).toBe(201);
      expect(res.body.data.route.name).toBe('Test Route 999');
      routeId = res.body.data.route.id as string;
    });

    it('anyone can get all routes', async () => {
      const res = await request(app)
        .get('/api/routes')
        .set('Authorization', `Bearer ${passengerToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.routes)).toBe(true);
    });

    it('can search routes by from', async () => {
      const res = await request(app)
        .get('/api/routes/search?from=Start City')
        .set('Authorization', `Bearer ${passengerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.routes.length).toBeGreaterThan(0);
    });

    it('admin can update a route', async () => {
      const res = await request(app)
        .put(`/api/routes/${routeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ fare: 500 });
      expect(res.status).toBe(200);
      expect(res.body.data.route.fare).toBe(500);
    });
  });

  describe('Bus CRUD', () => {
    it('admin can create a bus', async () => {
      const res = await request(app)
        .post('/api/buses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          busNumber: `TEST-${Date.now()}`,
          plateNumber: `RAB-${Date.now()}`,
          capacity: 40,
          routeId,
        });
      expect(res.status).toBe(201);
      expect(res.body.data.bus.capacity).toBe(40);
      busId = res.body.data.bus.id as string;
    });

    it('anyone can get all buses', async () => {
      const res = await request(app)
        .get('/api/buses')
        .set('Authorization', `Bearer ${passengerToken}`);
      expect(res.status).toBe(200);
    });

    it('admin can update bus status', async () => {
      const res = await request(app)
        .put(`/api/buses/${busId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'MAINTENANCE' });
      expect(res.status).toBe(200);
      expect(res.body.data.bus.status).toBe('MAINTENANCE');
    });

    it('passenger cannot create a bus', async () => {
      const res = await request(app)
        .post('/api/buses')
        .set('Authorization', `Bearer ${passengerToken}`)
        .send({ busNumber: 'HACK', plateNumber: 'HACK-1', capacity: 10 });
      expect(res.status).toBe(403);
    });
  });

  describe('Location validation', () => {
    it('rejects invalid latitude', async () => {
      const res = await request(app)
        .post('/api/locations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ busId, latitude: 999, longitude: 30.0, speed: 20, heading: 90 });
      expect(res.status).toBe(400);
    });

    it('rejects invalid longitude', async () => {
      const res = await request(app)
        .post('/api/locations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ busId, latitude: -1.9, longitude: 999, speed: 20, heading: 90 });
      expect(res.status).toBe(400);
    });
  });
});
