import { Response, NextFunction } from 'express';
import { BusStatus, DriverStatus, TripStatus } from '@prisma/client';
import prisma from '../config/database';
import { sendSuccess } from '../utils/response';
import { AuthenticatedRequest } from '../types';
import { fakeGpsService } from '../services/fakeGps.service';
import { AppError } from '../middleware/error.middleware';

export const getDashboard = async (
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const [
      totalBuses,
      activeBuses,
      totalDrivers,
      activeDrivers,
      totalRoutes,
      activeTrips,
    ] = await Promise.all([
      prisma.bus.count(),
      prisma.bus.count({ where: { status: BusStatus.ON_TRIP } }),
      prisma.driver.count(),
      prisma.driver.count({ where: { status: DriverStatus.ON_TRIP } }),
      prisma.route.count(),
      prisma.trip.count({ where: { status: TripStatus.ACTIVE } }),
    ]);

    sendSuccess(res, {
      statistics: {
        totalBuses,
        activeBuses,
        totalDrivers,
        activeDrivers,
        totalRoutes,
        activeTrips,
      },
    });
  } catch (err) { next(err); }
};

export const getLiveBuses = async (
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const buses = await prisma.bus.findMany({
      where: { status: BusStatus.ON_TRIP },
      include: {
        route: true,
        driver: { include: { user: { select: { name: true } } } },
        locations: { orderBy: { timestamp: 'desc' }, take: 1 },
      },
    });
    sendSuccess(res, { buses });
  } catch (err) { next(err); }
};

export const getActiveTrips = async (
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const trips = await prisma.trip.findMany({
      where: { status: TripStatus.ACTIVE },
      include: {
        bus: true,
        driver: { include: { user: { select: { name: true } } } },
        route: true,
      },
    });
    sendSuccess(res, { trips });
  } catch (err) { next(err); }
};

export const getStatistics = async (
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const [buses, drivers, routes, trips, totalLocations] = await Promise.all([
      prisma.bus.groupBy({ by: ['status'], _count: true }),
      prisma.driver.groupBy({ by: ['status'], _count: true }),
      prisma.route.count(),
      prisma.trip.groupBy({ by: ['status'], _count: true }),
      prisma.busLocation.count(),
    ]);

    sendSuccess(res, { buses, drivers, routes, trips, totalLocations });
  } catch (err) { next(err); }
};

// ─── Fake GPS Admin Endpoints ──────────────────

export const startFakeGps = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const busId = req.params['busId'] as string;
    const speedMultiplier = req.body?.speedMultiplier ? Number(req.body.speedMultiplier) : 1;
    const routeId = req.body?.routeId as string | undefined;

    const bus = await prisma.bus.findUnique({ where: { id: busId } });
    if (!bus) throw new AppError('Bus not found', 404);
    
    const assignedRouteId = routeId || bus.routeId;
    if (!assignedRouteId) throw new AppError('Bus has no assigned route', 400);

    const state = await fakeGpsService.start(busId, assignedRouteId, speedMultiplier);
    sendSuccess(res, {
      message: `Fake GPS started for bus ${bus.busNumber}`,
      busId,
      state,
    });
  } catch (err) { next(err); }
};

export const pauseFakeGps = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const busId = req.params['busId'] as string;
    const state = fakeGpsService.pause(busId);
    sendSuccess(res, { message: `Fake GPS paused for bus ${busId}`, busId, state });
  } catch (err) { next(err); }
};

export const resumeFakeGps = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const busId = req.params['busId'] as string;
    const state = fakeGpsService.resume(busId);
    sendSuccess(res, { message: `Fake GPS resumed for bus ${busId}`, busId, state });
  } catch (err) { next(err); }
};

export const stopFakeGps = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const busId = req.params['busId'] as string;
    await fakeGpsService.stop(busId);
    sendSuccess(res, { message: `Fake GPS stopped for bus ${busId}`, busId });
  } catch (err) { next(err); }
};

export const setFakeGpsSpeed = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const busId = req.params['busId'] as string;
    const multiplier = Number(req.body?.multiplier || req.body?.speedMultiplier || 1);
    const state = fakeGpsService.setSpeedMultiplier(busId, multiplier);
    sendSuccess(res, { message: `Fake GPS speed set to ${multiplier}x for bus ${busId}`, busId, state });
  } catch (err) { next(err); }
};

export const getFakeGpsStatus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const busId = req.params['busId'] as string;
    const status = fakeGpsService.getStatus(busId);
    sendSuccess(res, { busId, ...status });
  } catch (err) { next(err); }
};
