import { BusStatus } from '@prisma/client';

import prisma from '../config/database';
import { AppError } from '../middleware/error.middleware';

export interface CreateBusInput {
  busNumber: string;
  plateNumber: string;
  capacity: number;
  driverId?: string;
  routeId?: string;
}

export interface UpdateBusInput {
  busNumber?: string;
  plateNumber?: string;
  capacity?: number;
  status?: BusStatus;
  driverId?: string | null;
  routeId?: string | null;
}

const BUS_INCLUDE = {
  driver: {
    include: {
      user: {
        select: { name: true, email: true, phone: true },
      },
    },
  },
  route: true,
};

export const getAllBuses = async () => {
  return prisma.bus.findMany({ include: BUS_INCLUDE, orderBy: { createdAt: 'desc' } });
};

export const getActiveBuses = async () => {
  const buses = await prisma.bus.findMany({
    where: { status: BusStatus.ON_TRIP },
    include: {
      route: true,
      locations: {
        orderBy: { timestamp: 'desc' },
        take: 1,
      },
    },
  });

  return buses.map((bus: typeof buses[number]) => ({
    id: bus.id,
    busNumber: bus.busNumber,
    route: bus.route ? { name: bus.route.name } : null,
    location: bus.locations[0]
      ? {
          latitude: bus.locations[0].latitude,
          longitude: bus.locations[0].longitude,
        }
      : null,
    status: bus.status,
  }));
};

export const getBusById = async (id: string) => {
  const bus = await prisma.bus.findUnique({ where: { id }, include: BUS_INCLUDE });
  if (!bus) throw new AppError('Bus not found', 404);
  return bus;
};

export const createBus = async (data: CreateBusInput) => {
  if (data.driverId) {
    const driver = await prisma.driver.findUnique({ where: { id: data.driverId } });
    if (!driver) throw new AppError('Driver not found', 404);
  }
  if (data.routeId) {
    const route = await prisma.route.findUnique({ where: { id: data.routeId } });
    if (!route) throw new AppError('Route not found', 404);
  }

  return prisma.bus.create({ data, include: BUS_INCLUDE });
};

export const updateBus = async (id: string, data: UpdateBusInput) => {
  await getBusById(id); // throws if not found
  return prisma.bus.update({ where: { id }, data, include: BUS_INCLUDE });
};

export const deleteBus = async (id: string) => {
  await getBusById(id);
  return prisma.bus.delete({ where: { id } });
};

export const getLatestBusLocation = async (busId: string) => {
  await getBusById(busId);
  const location = await prisma.busLocation.findFirst({
    where: { busId },
    orderBy: { timestamp: 'desc' },
  });
  if (!location) throw new AppError('No location data found for this bus', 404);
  return location;
};

export const getBusLocationHistory = async (busId: string) => {
  await getBusById(busId);
  return prisma.busLocation.findMany({
    where: { busId },
    orderBy: { timestamp: 'desc' },
    take: 200,
  });
};
