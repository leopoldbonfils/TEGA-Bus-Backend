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

  const [adminUser, driverUser1, driverUser2, driverUser3, driverUser4] =
    await Promise.all([
      prisma.user.create({
        data: {
          name: 'MUGISHA Leopold',
          email: 'leopordbonfils@gmail.com',
          phone: '+250788000001',
          password: await hashPw('5Rwandan'),
          role: Role.ADMIN,
        },
      }),
      prisma.user.create({
        data: {
          name: 'Jean-Pierre Nkurunziza',
          email: 'driver@tegabus.com',
          phone: '+250788000002',
          password: await hashPw('Driver123!'),
          role: Role.DRIVER,
        },
      }),
      prisma.user.create({
        data: {
          name: 'Diane Uwamahoro',
          email: 'driver2@tegabus.com',
          phone: '+250788000003',
          password: await hashPw('Driver123!'),
          role: Role.DRIVER,
        },
      }),
      prisma.user.create({
        data: {
          name: 'Samuel Habimana',
          email: 'driver3@tegabus.com',
          phone: '+250788000005',
          password: await hashPw('Driver123!'),
          role: Role.DRIVER,
        },
      }),
      prisma.user.create({
        data: {
          name: 'Grace Ingabire',
          email: 'driver4@tegabus.com',
          phone: '+250788000006',
          password: await hashPw('Driver123!'),
          role: Role.DRIVER,
        },
      }),
    ]);

  console.log('  ✅ Admin:', adminUser.email);
  console.log('  ✅ Driver 1:', driverUser1.email);
  console.log('  ✅ Driver 2:', driverUser2.email);
  console.log('  ✅ Driver 3:', driverUser3.email);
  console.log('  ✅ Driver 4:', driverUser4.email);

  // ─── Drivers ──────────────────────────────────
  console.log('\n🚗 Creating driver profiles...');

  const [driver1, driver2, driver3, driver4] = await Promise.all([
    prisma.driver.create({
      data: {
        userId: driverUser1.id,
        driverNumber: 'DRV-001',
        licenseNumber: 'LIC-RW-001',
        status: DriverStatus.AVAILABLE,
      },
    }),
    prisma.driver.create({
      data: {
        userId: driverUser2.id,
        driverNumber: 'DRV-002',
        licenseNumber: 'LIC-RW-002',
        status: DriverStatus.AVAILABLE,
      },
    }),
    prisma.driver.create({
      data: {
        userId: driverUser3.id,
        driverNumber: 'DRV-003',
        licenseNumber: 'LIC-RW-003',
        status: DriverStatus.AVAILABLE,
      },
    }),
    prisma.driver.create({
      data: {
        userId: driverUser4.id,
        driverNumber: 'DRV-004',
        licenseNumber: 'LIC-RW-004',
        status: DriverStatus.AVAILABLE,
      },
    }),
  ]);

  console.log('  ✅ Drivers:', driver1.driverNumber, driver2.driverNumber, driver3.driverNumber, driver4.driverNumber);

  // ─── Routes ───────────────────────────────────
  // Route 101 — BLUE  — Downtown → Nyabugogo (west side of city, KG 5 Ave)
  // Route 202 — RED   — Nyabugogo → Kimironko (northeast corridor)
  // Route 203 — GREEN — Nyabugogo → Remera    (east corridor, direct)
  // Route 204 — PURPLE— Kimironko → Downtown  (reverse of 101, inner ring)
  console.log('\n🗺  Creating routes...');

  const [route101, route202, route203, route204] = await Promise.all([
    prisma.route.create({
      data: {
        name: 'Route 101 — Downtown → Nyabugogo',
        startLocation: 'Downtown (Kigali City)',
        destination: 'Nyabugogo Terminal',
        fare: 500,
        estimatedDuration: 40,
      },
    }),
    prisma.route.create({
      data: {
        name: 'Route 202 — Nyabugogo → Kimironko',
        startLocation: 'Nyabugogo Terminal',
        destination: 'Kimironko Market',
        fare: 400,
        estimatedDuration: 35,
      },
    }),
    prisma.route.create({
      data: {
        name: 'Route 203 — Nyabugogo → Remera',
        startLocation: 'Nyabugogo Terminal',
        destination: 'Remera Bus Park',
        fare: 300,
        estimatedDuration: 25,
      },
    }),
    prisma.route.create({
      data: {
        name: 'Route 204 — Kimironko → Downtown',
        startLocation: 'Kimironko Market',
        destination: 'Downtown (Kigali City)',
        fare: 500,
        estimatedDuration: 38,
      },
    }),
  ]);

  console.log('  ✅ Route 101:', route101.name);
  console.log('  ✅ Route 202:', route202.name);
  console.log('  ✅ Route 203:', route203.name);
  console.log('  ✅ Route 204:', route204.name);

  // ─── Bus Stops ────────────────────────────────
  console.log('\n🚏 Creating bus stops...');

  // ── Route 101 BLUE: Downtown → Kigali City → Rwandex → Kacyiru → Nyabugogo
  //    Western route following KG 5 Ave / NR1 toward Nyabugogo
  await prisma.busStop.createMany({
    data: [
      { name: 'Downtown',    latitude: -1.9500, longitude: 30.0580, order: 1, routeId: route101.id },
      { name: 'Kigali City', latitude: -1.9536, longitude: 30.0605, order: 2, routeId: route101.id },
      { name: 'Rwandex',     latitude: -1.9480, longitude: 30.0500, order: 3, routeId: route101.id },
      { name: 'Kacyiru',     latitude: -1.9405, longitude: 30.0820, order: 4, routeId: route101.id },
      { name: 'Nyabugogo',   latitude: -1.9346, longitude: 30.0540, order: 5, routeId: route101.id },
    ],
  });

  // ── Route 202 RED: Nyabugogo → Kacyiru → Remera → Kimironko
  //    Northeast corridor via KG 7 Ave then east
  await prisma.busStop.createMany({
    data: [
      { name: 'Nyabugogo',  latitude: -1.9346, longitude: 30.0540, order: 1, routeId: route202.id },
      { name: 'Kacyiru',    latitude: -1.9405, longitude: 30.0820, order: 2, routeId: route202.id },
      { name: 'Remera',     latitude: -1.9502, longitude: 30.1073, order: 3, routeId: route202.id },
      { name: 'Kimironko',  latitude: -1.9400, longitude: 30.1200, order: 4, routeId: route202.id },
    ],
  });

  // ── Route 203 GREEN: Nyabugogo → Kigali City → Remera
  //    Direct east route via city center
  await prisma.busStop.createMany({
    data: [
      { name: 'Nyabugogo',   latitude: -1.9346, longitude: 30.0540, order: 1, routeId: route203.id },
      { name: 'Kigali City', latitude: -1.9536, longitude: 30.0605, order: 2, routeId: route203.id },
      { name: 'Gisimenti',   latitude: -1.9540, longitude: 30.1030, order: 3, routeId: route203.id },
      { name: 'Remera',      latitude: -1.9502, longitude: 30.1073, order: 4, routeId: route203.id },
    ],
  });

  // ── Route 204 PURPLE: Kimironko → Gisimenti → Kigali City → Downtown
  //    Return inner-ring route
  await prisma.busStop.createMany({
    data: [
      { name: 'Kimironko',   latitude: -1.9400, longitude: 30.1200, order: 1, routeId: route204.id },
      { name: 'Gisimenti',   latitude: -1.9540, longitude: 30.1030, order: 2, routeId: route204.id },
      { name: 'Kigali City', latitude: -1.9536, longitude: 30.0605, order: 3, routeId: route204.id },
      { name: 'Downtown',    latitude: -1.9500, longitude: 30.0580, order: 4, routeId: route204.id },
    ],
  });

  console.log('  ✅ Route 101 stops: 5 stops (Downtown → Nyabugogo)');
  console.log('  ✅ Route 202 stops: 4 stops (Nyabugogo → Kimironko)');
  console.log('  ✅ Route 203 stops: 4 stops (Nyabugogo → Remera)');
  console.log('  ✅ Route 204 stops: 4 stops (Kimironko → Downtown)');

  // ─── Buses ────────────────────────────────────
  console.log('\n🚌 Creating buses...');

  const [bus101, bus202, bus203, bus204] = await Promise.all([
    prisma.bus.create({
      data: {
        busNumber: '101',
        plateNumber: 'RAB 101 A',
        capacity: 45,
        status: BusStatus.ACTIVE,
        driverId: driver1.id,
        routeId: route101.id,
      },
    }),
    prisma.bus.create({
      data: {
        busNumber: '202',
        plateNumber: 'RAB 202 B',
        capacity: 45,
        status: BusStatus.ACTIVE,
        driverId: driver2.id,
        routeId: route202.id,
      },
    }),
    prisma.bus.create({
      data: {
        busNumber: '203',
        plateNumber: 'RAB 203 C',
        capacity: 30,
        status: BusStatus.ACTIVE,
        driverId: driver3.id,
        routeId: route203.id,
      },
    }),
    prisma.bus.create({
      data: {
        busNumber: '204',
        plateNumber: 'RAB 204 D',
        capacity: 35,
        status: BusStatus.ACTIVE,
        driverId: driver4.id,
        routeId: route204.id,
      },
    }),
  ]);

  console.log('  ✅ Bus 101 → Route 101 BLUE  (Jean-Pierre Nkurunziza)');
  console.log('  ✅ Bus 202 → Route 202 RED   (Diane Uwamahoro)');
  console.log('  ✅ Bus 203 → Route 203 GREEN (Samuel Habimana)');
  console.log('  ✅ Bus 204 → Route 204 PURPLE(Grace Ingabire)');

  // ─── Sample completed trip ────────────────────
  console.log('\n📋 Creating sample completed trip...');

  await prisma.trip.create({
    data: {
      busId: bus101.id,
      driverId: driver1.id,
      routeId: route101.id,
      status: 'COMPLETED',
      startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      endedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    },
  });

  console.log('  ✅ Sample completed trip created');

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
