import { BusStatus, DriverStatus, TripStatus } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import prisma from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { socketService } from './socket.service';
import { fakeGpsService } from './fakeGps.service';

type PrismaTx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

const TRIP_INCLUDE = {
  bus: true,
  driver: { include: { user: { select: { name: true, email: true } } } },
  route: { include: { stops: { orderBy: { order: 'asc' as const } } } },
};

export const getAllTrips = async () => {
  return prisma.trip.findMany({ include: TRIP_INCLUDE, orderBy: { createdAt: 'desc' } });
};

export const getTripById = async (id: string) => {
  const trip = await prisma.trip.findUnique({ where: { id }, include: TRIP_INCLUDE });
  if (!trip) throw new AppError('Trip not found', 404);
  return trip;
};

export const getActiveTrips = async () => {
  return prisma.trip.findMany({
    where: { status: TripStatus.ACTIVE },
    include: TRIP_INCLUDE,
  });
};

export const startTrip = async (driverId: string) => {
  const driver = await prisma.driver.findUnique({
    where: { id: driverId },
    include: { buses: { include: { route: true } } },
  });

  if (!driver) throw new AppError('Driver not found', 404);

  const bus = driver.buses[0];
  if (!bus) throw new AppError('No bus assigned to this driver', 400);
  if (!bus.routeId) throw new AppError('Bus is not assigned to a route', 400);

  const existingTrip = await prisma.trip.findFirst({
    where: { driverId, status: TripStatus.ACTIVE },
  });
  if (existingTrip) throw new AppError('Driver already has an active trip', 400);

  const trip = await prisma.$transaction(async (tx: PrismaTx) => {
    const newTrip = await tx.trip.create({
      data: {
        busId: bus.id,
        driverId,
        routeId: bus.routeId!,
        status: TripStatus.ACTIVE,
        startedAt: new Date(),
      },
      include: TRIP_INCLUDE,
    });

    await tx.bus.update({
      where: { id: bus.id },
      data: { status: BusStatus.ON_TRIP },
    });

    await tx.driver.update({
      where: { id: driverId },
      data: { status: DriverStatus.ON_TRIP },
    });

    return newTrip;
  });

  socketService.emit('trip:started', { tripId: trip.id, busId: bus.id, routeId: bus.routeId });

  if (bus.routeId) {
    fakeGpsService.start(bus.id, bus.routeId).catch(console.error);
  }

  return trip;
};

export const endTrip = async (tripId: string, driverId: string) => {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { bus: true },
  });

  if (!trip) throw new AppError('Trip not found', 404);
  if (trip.driverId !== driverId) throw new AppError('You do not own this trip', 403);
  if (trip.status !== TripStatus.ACTIVE) throw new AppError('Trip is not active', 400);

  const updated = await prisma.$transaction(async (tx: PrismaTx) => {
    const completedTrip = await tx.trip.update({
      where: { id: tripId },
      data: {
        status: TripStatus.COMPLETED,
        endedAt: new Date(),
      },
      include: TRIP_INCLUDE,
    });

    await tx.bus.update({
      where: { id: trip.busId },
      data: { status: BusStatus.ACTIVE },
    });

    await tx.driver.update({
      where: { id: driverId },
      data: { status: DriverStatus.AVAILABLE },
    });

    return completedTrip;
  });

  fakeGpsService.stop(trip.busId);

  socketService.emit('trip:ended', {
    tripId,
    busId: trip.busId,
    status: TripStatus.COMPLETED,
  });

  return updated;
};
