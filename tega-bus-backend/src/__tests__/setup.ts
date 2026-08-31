import prisma from '../config/database';

export default async function setup(): Promise<void> {
  await prisma.busLocation.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.bus.deleteMany();
  await prisma.busStop.deleteMany();
  await prisma.route.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$disconnect();
}
