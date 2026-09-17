import prisma from '../config/database';
import { fakeGpsService } from '../services/fakeGps.service';

export default async function teardown(): Promise<void> {
  await fakeGpsService.stopAll();
  await prisma.busLocation.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.bus.deleteMany();
  await prisma.busStop.deleteMany();
  await prisma.route.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$disconnect();
}
