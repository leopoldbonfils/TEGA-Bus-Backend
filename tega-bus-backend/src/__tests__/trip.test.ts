import request from 'supertest';
import app from '../app';
import prisma from '../config/database';
import { hashPassword } from '../utils/password';
import { signToken } from '../utils/jwt';
import { Role, DriverStatus } from '@prisma/client';

// Remote database calls (Supabase) are slow — give the whole file 30 seconds
jest.setTimeout(30000);

describe('Trip Flow API Tests', () => {
  let driverToken: string;
  let passengerToken: string;
  let driverId: string;
  let busId: string;
  let routeId: string;

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
  }, 30000);

  beforeEach(async () => {
    // Reset trip, driver, and bus states so each test starts clean
    await prisma.trip.deleteMany();
    await prisma.driver.update({ where: { id: driverId }, data: { status: 'AVAILABLE' } });
    await prisma.bus.update({ where: { id: busId }, data: { status: 'ACTIVE' } });
  }, 30000);

  test('driver can start trip', async () => {
    const response = await request(app)
      .post('/api/trips/start')
      .set('Authorization', `Bearer ${driverToken}`);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.trip.status).toBe('ACTIVE');
  });

  test('active trip can be viewed', async () => {
    // Start a trip first
    const startResponse = await request(app)
      .post('/api/trips/start')
      .set('Authorization', `Bearer ${driverToken}`);

    const tripId = startResponse.body.data.trip.id;

    // View active trips as a passenger
    const response = await request(app)
      .get('/api/trips/active')
      .set('Authorization', `Bearer ${passengerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const found = response.body.data.trips.some((t: { id: string }) => t.id === tripId);
    expect(found).toBe(true);
  });

  test('driver cannot start another active trip', async () => {
    // Start first trip
    await request(app)
      .post('/api/trips/start')
      .set('Authorization', `Bearer ${driverToken}`);

    // Try starting a second trip while first is active
    const response = await request(app)
      .post('/api/trips/start')
      .set('Authorization', `Bearer ${driverToken}`);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  test('driver can end trip', async () => {
    // Start a trip
    const startResponse = await request(app)
      .post('/api/trips/start')
      .set('Authorization', `Bearer ${driverToken}`);

    const tripId = startResponse.body.data.trip.id;

    // End the trip
    const response = await request(app)
      .post(`/api/trips/${tripId}/end`)
      .set('Authorization', `Bearer ${driverToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.trip.status).toBe('COMPLETED');
  });

  test('bus becomes ACTIVE after trip', async () => {
    // Start and end trip
    const startResponse = await request(app)
      .post('/api/trips/start')
      .set('Authorization', `Bearer ${driverToken}`);

    const tripId = startResponse.body.data.trip.id;

    await request(app)
      .post(`/api/trips/${tripId}/end`)
      .set('Authorization', `Bearer ${driverToken}`);

    // Check bus status in database
    const bus = await prisma.bus.findUnique({ where: { id: busId } });
    expect(bus?.status).toBe('ACTIVE');
  });

  test('driver becomes AVAILABLE after trip', async () => {
    // Start and end trip
    const startResponse = await request(app)
      .post('/api/trips/start')
      .set('Authorization', `Bearer ${driverToken}`);

    const tripId = startResponse.body.data.trip.id;

    await request(app)
      .post(`/api/trips/${tripId}/end`)
      .set('Authorization', `Bearer ${driverToken}`);

    // Check driver status in database
    const driver = await prisma.driver.findUnique({ where: { id: driverId } });
    expect(driver?.status).toBe('AVAILABLE');
  });

  test('passenger cannot start trip', async () => {
    const response = await request(app)
      .post('/api/trips/start')
      .set('Authorization', `Bearer ${passengerToken}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });
});

