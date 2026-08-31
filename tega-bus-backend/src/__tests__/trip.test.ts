import request from 'supertest';
import app from '../app';
import prisma from '../config/database';
import { hashPassword } from '../utils/password';
import { signToken } from '../utils/jwt';
import { Role, DriverStatus } from '@prisma/client';

describe('Trip Flow API', () => {
  let adminToken!: string;
  let driverToken!: string;
  let passengerToken!: string;
  let driverId!: string;
  let busId!: string;
  let routeId!: string;
  let tripId!: string;


  beforeAll(async () => {
    const pw = await hashPassword('Test1234!');

    const [adminUser, driverUser, passengerUser] = await Promise.all([
      prisma.user.create({
        data: { name: 'Trip Admin', email: `trip_admin+${Date.now()}@test.com`, password: pw, role: Role.ADMIN },
      }),
      prisma.user.create({
        data: { name: 'Trip Driver', email: `trip_driver+${Date.now()}@test.com`, password: pw, role: Role.DRIVER },
      }),
      prisma.user.create({
        data: { name: 'Trip Passenger', email: `trip_pass+${Date.now()}@test.com`, password: pw, role: Role.PASSENGER },
      }),
    ]);

    adminToken = signToken({ userId: adminUser.id, role: adminUser.role });
    driverToken = signToken({ userId: driverUser.id, role: driverUser.role });
    passengerToken = signToken({ userId: passengerUser.id, role: passengerUser.role });

    const driver = await prisma.driver.create({
      data: {
        userId: driverUser.id,
        driverNumber: `DRV-TEST-${Date.now()}`,
        licenseNumber: `LIC-TEST-${Date.now()}`,
        status: DriverStatus.AVAILABLE,
      },
    });
    driverId = driver.id;

    const route = await prisma.route.create({
      data: {
        name: 'Test Route for Trips',
        startLocation: 'Stop A',
        destination: 'Stop B',
        fare: 300,
        estimatedDuration: 20,
      },
    });
    routeId = route.id;

    await prisma.busStop.createMany({
      data: [
        { name: 'Stop A', latitude: -1.94, longitude: 30.06, order: 1, routeId },
        { name: 'Stop B', latitude: -1.95, longitude: 30.07, order: 2, routeId },
      ],
    });

    const bus = await prisma.bus.create({
      data: {
        busNumber: `TBUS-${Date.now()}`,
        plateNumber: `TPLATE-${Date.now()}`,
        capacity: 30,
        driverId,
        routeId,
      },
    });
    busId = bus.id;
  });

  it('driver can start a trip', async () => {
    const res = await request(app)
      .post('/api/trips/start')
      .set('Authorization', `Bearer ${driverToken}`);
    expect(res.status).toBe(201);
    expect(res.body.data.trip.status).toBe('ACTIVE');
    tripId = res.body.data.trip.id as string;
  });

  it('active trip appears in GET /api/trips/active', async () => {
    const res = await request(app)
      .get('/api/trips/active')
      .set('Authorization', `Bearer ${passengerToken}`);
    expect(res.status).toBe(200);
    const found = (res.body.data.trips as Array<{ id: string }>).some((t) => t.id === tripId);
    expect(found).toBe(true);
  });

  it('driver cannot start another trip while one is active', async () => {
    const res = await request(app)
      .post('/api/trips/start')
      .set('Authorization', `Bearer ${driverToken}`);
    expect(res.status).toBe(400);
  });

  it('driver can end the trip', async () => {
    const res = await request(app)
      .post(`/api/trips/${tripId}/end`)
      .set('Authorization', `Bearer ${driverToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.trip.status).toBe('COMPLETED');
    expect(res.body.data.trip.endedAt).toBeTruthy();
  });

  it('bus status returns to ACTIVE after trip ends', async () => {
    const bus = await prisma.bus.findUnique({ where: { id: busId } });
    expect(bus?.status).toBe('ACTIVE');
  });

  it('driver status returns to AVAILABLE after trip ends', async () => {
    const driver = await prisma.driver.findUnique({ where: { id: driverId } });
    expect(driver?.status).toBe('AVAILABLE');
  });

  it('passenger cannot start a trip', async () => {
    const res = await request(app)
      .post('/api/trips/start')
      .set('Authorization', `Bearer ${passengerToken}`);
    expect(res.status).toBe(403);
  });
});
