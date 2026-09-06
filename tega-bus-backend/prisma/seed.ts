import 'dotenv/config';
import { PrismaClient, Role, BusStatus, DriverStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🌱 Seeding database...\n');

  // ─── Clean slate ──────────────────────────────
  await prisma.busLocation.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.bus.deleteMany();
  await prisma.busStop.deleteMany();
  await prisma.route.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.user.deleteMany();

  const hashPw = (pw: string) => bcrypt.hash(pw, 12);

  // ─── Users ────────────────────────────────────
  console.log('👤 Creating users...');

  const adminUser = await prisma.user.create({
    data: {
      name: 'MUGISHA Leopold',
      email: 'leopordbonfils@gmail.com',
      phone: '+250788000001',
      password: await hashPw('5Rwandan'),
      role: Role.ADMIN,
    },
  });
  const driverUser1 = await prisma.user.create({
    data: {
      name: 'Jean-Pierre Nkurunziza',
      email: 'driver@tegabus.com',
      phone: '+250788000002',
      password: await hashPw('Driver123!'),
      role: Role.DRIVER,
    },
  });
  const driverUser2 = await prisma.user.create({
    data: {
      name: 'Diane Uwamahoro',
      email: 'driver2@tegabus.com',
      phone: '+250788000003',
      password: await hashPw('Driver123!'),
      role: Role.DRIVER,
    },
  });
  const driverUser3 = await prisma.user.create({
    data: {
      name: 'Samuel Habimana',
      email: 'driver3@tegabus.com',
      phone: '+250788000005',
      password: await hashPw('Driver123!'),
      role: Role.DRIVER,
    },
  });
  const driverUser4 = await prisma.user.create({
    data: {
      name: 'Grace Ingabire',
      email: 'driver4@tegabus.com',
      phone: '+250788000006',
      password: await hashPw('Driver123!'),
      role: Role.DRIVER,
    },
  });
  const driverUser5 = await prisma.user.create({
    data: {
      name: 'Mucyo Christ',
      email: 'driver5@tegabus.com',
      phone: '+250788000007',
      password: await hashPw('Driver123!'),
      role: Role.DRIVER,
    },
  });

  console.log('  ✅ Users created');

  // ─── Drivers ──────────────────────────────────
  console.log('\n🚗 Creating driver profiles...');

  const driver1 = await prisma.driver.create({
    data: {
      userId: driverUser1.id,
      driverNumber: 'DRV-001',
      licenseNumber: 'LIC-RW-001',
      status: DriverStatus.ON_TRIP,
    },
  });
  const driver2 = await prisma.driver.create({
    data: {
      userId: driverUser2.id,
      driverNumber: 'DRV-002',
      licenseNumber: 'LIC-RW-002',
      status: DriverStatus.AVAILABLE,
    },
  });
  const driver3 = await prisma.driver.create({
    data: {
      userId: driverUser3.id,
      driverNumber: 'DRV-003',
      licenseNumber: 'LIC-RW-003',
      status: DriverStatus.AVAILABLE,
    },
  });
  const driver4 = await prisma.driver.create({
    data: {
      userId: driverUser4.id,
      driverNumber: 'DRV-004',
      licenseNumber: 'LIC-RW-004',
      status: DriverStatus.AVAILABLE,
    },
  });
  const driver5 = await prisma.driver.create({
    data: {
      userId: driverUser5.id,
      driverNumber: 'DRV-005',
      licenseNumber: 'LIC-RW-005',
      status: DriverStatus.ON_TRIP,
    },
  });

  console.log('  ✅ Drivers created');

  // ─── Routes ───────────────────────────────────
  console.log('\n🗺  Creating routes...');

  const route101 = await prisma.route.create({
    data: {
      name: 'Route 101 — Downtown → Nyabugogo',
      startLocation: 'Downtown (Kigali City)',
      destination: 'Nyabugogo Terminal',
      fare: 500,
      estimatedDuration: 40,
    },
  });
  const route202 = await prisma.route.create({
    data: {
      name: 'Route 202 — Nyabugogo → Kimironko',
      startLocation: 'Nyabugogo Terminal',
      destination: 'Kimironko Market',
      fare: 400,
      estimatedDuration: 35,
    },
  });
  const route203 = await prisma.route.create({
    data: {
      name: 'Route 203 — Nyabugogo → Remera',
      startLocation: 'Nyabugogo Terminal',
      destination: 'Remera Bus Park',
      fare: 300,
      estimatedDuration: 25,
    },
  });
  const route204 = await prisma.route.create({
    data: {
      name: 'Route 204 — Kimironko → Downtown',
      startLocation: 'Kimironko Market',
      destination: 'Downtown (Kigali City)',
      fare: 500,
      estimatedDuration: 38,
    },
  });
  const route303 = await prisma.route.create({
    data: {
      name: 'Route 303 — Nyabugogo → Nyacyonga',
      startLocation: 'Nyabugogo Terminal',
      destination: 'Nyacyonga',
      fare: 400,
      estimatedDuration: 30,
    },
  });
  const route305 = await prisma.route.create({
    data: {
      name: 'Route 305 — Nyabugogo → Nyacyonga (via Batsinda)',
      startLocation: 'Nyabugogo Terminal',
      destination: 'Nyacyonga',
      fare: 400,
      estimatedDuration: 35,
    },
  });

  console.log('  ✅ Routes created');

  // ─── Bus Stops ────────────────────────────────
  console.log('\n🚏 Creating bus stops...');

  await prisma.busStop.createMany({
    data: [
      { name: 'Downtown', latitude: -1.9500, longitude: 30.0580, order: 1, routeId: route101.id },
      { name: 'Kigali City', latitude: -1.9536, longitude: 30.0605, order: 2, routeId: route101.id },
      { name: 'Rwandex', latitude: -1.9480, longitude: 30.0500, order: 3, routeId: route101.id },
      { name: 'Kacyiru', latitude: -1.9405, longitude: 30.0820, order: 4, routeId: route101.id },
      { name: 'Nyabugogo', latitude: -1.9346, longitude: 30.0540, order: 5, routeId: route101.id },
    ],
  });

  await prisma.busStop.createMany({
    data: [
      { name: 'Nyabugogo', latitude: -1.9346, longitude: 30.0540, order: 1, routeId: route202.id },
      { name: 'Kacyiru', latitude: -1.9405, longitude: 30.0820, order: 2, routeId: route202.id },
      { name: 'Remera', latitude: -1.9502, longitude: 30.1073, order: 3, routeId: route202.id },
      { name: 'Kimironko Terminus', latitude: -1.9400, longitude: 30.1200, order: 4, routeId: route202.id },
    ],
  });

  await prisma.busStop.createMany({
    data: [
      { name: 'Nyabugogo', latitude: -1.9346, longitude: 30.0540, order: 1, routeId: route203.id },
      { name: 'Kigali City', latitude: -1.9536, longitude: 30.0605, order: 2, routeId: route203.id },
      { name: 'Gisimenti', latitude: -1.9540, longitude: 30.1030, order: 3, routeId: route203.id },
      { name: 'Remera', latitude: -1.9502, longitude: 30.1073, order: 4, routeId: route203.id },
    ],
  });

  await prisma.busStop.createMany({
    data: [
      { name: 'Kimironko Terminus', latitude: -1.9400, longitude: 30.1200, order: 1, routeId: route204.id },
      { name: 'Gisimenti', latitude: -1.9540, longitude: 30.1030, order: 2, routeId: route204.id },
      { name: 'Kigali City', latitude: -1.9536, longitude: 30.0605, order: 3, routeId: route204.id },
      { name: 'Downtown', latitude: -1.9500, longitude: 30.0580, order: 4, routeId: route204.id },
    ],
  });

  await prisma.busStop.createMany({
    data: [
      { name: 'Nyabugogo', latitude: -1.9355, longitude: 30.0540, order: 1, routeId: route303.id },
      { name: 'Gatsata', latitude: -1.9220, longitude: 30.0515, order: 2, routeId: route303.id },
      { name: 'Karuruma', latitude: -1.8965, longitude: 30.0570, order: 3, routeId: route303.id },
      { name: 'Nyacyonga', latitude: -1.8682, longitude: 30.0847, order: 4, routeId: route303.id },
    ],
  });

  await prisma.busStop.createMany({
    data: [
      { name: 'Nyabugogo', latitude: -1.9355, longitude: 30.0540, order: 1, routeId: route305.id },
      { name: 'Gisozi', latitude: -1.9315, longitude: 30.0645, order: 2, routeId: route305.id },
      { name: 'Kagugu', latitude: -1.9180, longitude: 30.0785, order: 3, routeId: route305.id },
      { name: 'Batsinda', latitude: -1.8985, longitude: 30.0818, order: 4, routeId: route305.id },
      { name: 'Nyacyonga', latitude: -1.8682, longitude: 30.0847, order: 5, routeId: route305.id },
    ],
  });

  console.log('  ✅ Bus stops created');

  // ─── Buses ────────────────────────────────────
  console.log('\n🚌 Creating buses...');

  const bus101 = await prisma.bus.create({
    data: {
      busNumber: '101',
      plateNumber: 'RAB 101 A',
      capacity: 45,
      status: BusStatus.ON_TRIP,
      driverId: driver1.id,
      routeId: route101.id,
    },
  });
  const bus102 = await prisma.bus.create({
    data: {
      busNumber: '102',
      plateNumber: 'RAB 102 B',
      capacity: 45,
      status: BusStatus.ACTIVE,
      driverId: driver2.id,
      routeId: route101.id,
    },
  });
  const bus105 = await prisma.bus.create({
    data: {
      busNumber: '105',
      plateNumber: 'RAB 105 C',
      capacity: 40,
      status: BusStatus.ACTIVE,
      driverId: driver3.id,
      routeId: route204.id,
    },
  });
  const bus202 = await prisma.bus.create({
    data: {
      busNumber: '202',
      plateNumber: 'RAB 202 B',
      capacity: 45,
      status: BusStatus.ON_TRIP,
      routeId: route202.id,
    },
  });
  const bus203 = await prisma.bus.create({
    data: {
      busNumber: '203',
      plateNumber: 'RAB 203 C',
      capacity: 30,
      status: BusStatus.ACTIVE,
      routeId: route203.id,
    },
  });
  const bus204 = await prisma.bus.create({
    data: {
      busNumber: '204',
      plateNumber: 'RAB 204 D',
      capacity: 35,
      status: BusStatus.ACTIVE,
      driverId: driver4.id,
      routeId: route204.id,
    },
  });
  const bus303 = await prisma.bus.create({
    data: {
      busNumber: '303',
      plateNumber: 'RAD 303 A',
      capacity: 50,
      status: BusStatus.ON_TRIP,
      driverId: driver5.id,
      routeId: route303.id,
    },
  });
  const bus305 = await prisma.bus.create({
    data: {
      busNumber: '305',
      plateNumber: 'RAD 305 B',
      capacity: 50,
      status: BusStatus.ON_TRIP,
      driverId: driver3.id,
      routeId: route305.id,
    },
  });

  console.log('  ✅ Buses created');

  // ─── Initial Telemetry & Locations ────────────
  console.log('\n📍 Creating initial bus locations...');

  await prisma.busLocation.create({
    data: {
      busId: bus101.id,
      latitude: -1.9430,
      longitude: 30.0670,
      speed: 28,
      heading: 320,
    },
  });
  await prisma.busLocation.create({
    data: {
      busId: bus102.id,
      latitude: -1.9346,
      longitude: 30.0540,
      speed: 0,
      heading: 0,
    },
  });
  await prisma.busLocation.create({
    data: {
      busId: bus202.id,
      latitude: -1.9380,
      longitude: 30.0650,
      speed: 32,
      heading: 75,
    },
  });
  await prisma.busLocation.create({
    data: {
      busId: bus203.id,
      latitude: -1.9346,
      longitude: 30.0540,
      speed: 0,
      heading: 0,
    },
  });
  await prisma.busLocation.create({
    data: {
      busId: bus303.id,
      latitude: -1.9270,
      longitude: 30.0535,
      speed: 30,
      heading: 5,
    },
  });
  await prisma.busLocation.create({
    data: {
      busId: bus305.id,
      latitude: -1.9315,
      longitude: 30.0645,
      speed: 28,
      heading: 45,
    },
  });

  console.log('  ✅ Locations created');

  // ─── Active & Scheduled Trips ─────────────────
  console.log('\n📋 Creating active & scheduled trips...');

  await prisma.trip.create({
    data: {
      busId: bus101.id,
      driverId: driver1.id,
      routeId: route101.id,
      status: 'ACTIVE',
      startedAt: new Date(Date.now() - 12 * 60 * 1000),
    },
  });
  await prisma.trip.create({
    data: {
      busId: bus202.id,
      driverId: driver2.id,
      routeId: route202.id,
      status: 'ACTIVE',
      startedAt: new Date(Date.now() - 8 * 60 * 1000),
    },
  });
  await prisma.trip.create({
    data: {
      busId: bus303.id,
      driverId: driver5.id,
      routeId: route303.id,
      status: 'ACTIVE',
      startedAt: new Date(Date.now() - 5 * 60 * 1000),
    },
  });
  await prisma.trip.create({
    data: {
      busId: bus305.id,
      driverId: driver3.id,
      routeId: route305.id,
      status: 'ACTIVE',
      startedAt: new Date(Date.now() - 3 * 60 * 1000),
    },
  });
  await prisma.trip.create({
    data: {
      busId: bus204.id,
      driverId: driver4.id,
      routeId: route204.id,
      status: 'SCHEDULED',
    },
  });

  console.log('  ✅ Active trips created');

  console.log('  ✅ Active trips created for Bus 101, Bus 202, and Bus 303 (Nyacyonga)');

  // ─── Summary ──────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Database seeded successfully!\n');
  console.log('Demo Accounts:');
  console.log('  👑 ADMIN    — admin@tegabus.com   / Admin123!');
  console.log('  🚗 DRIVER 1 — driver@tegabus.com  / Driver123!  (Bus 101 — BLUE)');
  console.log('  🚗 DRIVER 2 — driver2@tegabus.com / Driver123!  (Bus 202 — RED)');
  console.log('  🚗 DRIVER 3 — driver3@tegabus.com / Driver123!  (Bus 203 — GREEN)');
  console.log('  🚗 DRIVER 4 — driver4@tegabus.com / Driver123!  (Bus 204 — PURPLE)');
  console.log('\nRoutes:');
  console.log('  🔵 Route 101 — Downtown → Nyabugogo    (Bus 101)');
  console.log('  🔴 Route 202 — Nyabugogo → Kimironko   (Bus 202)');
  console.log('  🟢 Route 203 — Nyabugogo → Remera      (Bus 203)');
  console.log('  🟣 Route 204 — Kimironko → Downtown    (Bus 204)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
