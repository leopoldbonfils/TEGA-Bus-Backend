import prisma from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { hashPassword } from '../utils/password';
import { Role } from '@prisma/client';
import { PrismaClient } from '@prisma/client';

type PrismaTx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export interface CreateDriverInput {
  name: string;
  email: string;
  phone?: string;
  password: string;
  driverNumber: string;
  licenseNumber: string;
}

export interface UpdateDriverInput {
  driverNumber?: string;
  licenseNumber?: string;
  status?: 'AVAILABLE' | 'ON_TRIP' | 'OFFLINE';
}

const DRIVER_INCLUDE = {
  user: {
    select: { id: true, name: true, email: true, phone: true, role: true },
  },
  buses: {
    include: { route: true },
  },
};

export const getAllDrivers = async () => {
  return prisma.driver.findMany({
    include: DRIVER_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
};

export const getDriverById = async (id: string) => {
  const driver = await prisma.driver.findUnique({ where: { id }, include: DRIVER_INCLUDE });
  if (!driver) throw new AppError('Driver not found', 404);
  return driver;
};

export const getDriverByUserId = async (userId: string) => {
  const driver = await prisma.driver.findUnique({
    where: { userId },
    include: DRIVER_INCLUDE,
  });
  if (!driver) throw new AppError('Driver profile not found', 404);
  return driver;
};

export const createDriver = async (input: CreateDriverInput) => {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AppError('Email already in use', 409);

  const hashedPassword = await hashPassword(input.password);

  const result = await prisma.$transaction(async (tx: PrismaTx) => {
    const user = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        password: hashedPassword,
        role: Role.DRIVER,
      },
    });

    const driver = await tx.driver.create({
      data: {
        userId: user.id,
        driverNumber: input.driverNumber,
        licenseNumber: input.licenseNumber,
      },
      include: DRIVER_INCLUDE,
    });

    return driver;
  });

  return result;
};

export const updateDriver = async (id: string, data: UpdateDriverInput) => {
  await getDriverById(id);
  return prisma.driver.update({ where: { id }, data, include: DRIVER_INCLUDE });
};

export const getDriverTrips = async (driverId: string) => {
  return prisma.trip.findMany({
    where: { driverId },
    include: { bus: true, route: true },
    orderBy: { createdAt: 'desc' },
  });
};
