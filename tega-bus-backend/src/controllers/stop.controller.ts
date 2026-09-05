import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { sendSuccess, sendCreated } from '../utils/response';
import { AppError } from '../middleware/error.middleware';
import { AuthenticatedRequest } from '../types';
import { fakeGpsService } from '../services/fakeGps.service';

function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export interface StopBusInfo {
  id: string;
  busNumber: string;
  plateNumber: string;
  direction: string;
  routeName: string;
  speed: number;
  isMoving: boolean;
  motionStatus: 'MOVING' | 'PARKED';
}

export interface StopDirectionGroup {
  direction: string;
  buses: StopBusInfo[];
}

export const getNearbyStops = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const latStr = req.query['latitude'] as string | undefined;
    const lngStr = req.query['longitude'] as string | undefined;

    if (!latStr || !lngStr) {
      throw new AppError('latitude and longitude query parameters are required', 400);
    }

    const passengerLat = parseFloat(latStr);
    const passengerLng = parseFloat(lngStr);

    if (isNaN(passengerLat) || isNaN(passengerLng)) {
      throw new AppError('Invalid latitude or longitude format', 400);
    }

    const stops = await prisma.busStop.findMany({
      include: {
        route: {
          include: {
            buses: {
              include: {
                driver: { include: { user: true } },
                locations: { orderBy: { timestamp: 'desc' }, take: 1 },
              },
            },
          },
        },
      },
    });

    const stopsWithDistance = stops.map((stop) => {
      const distanceMeters = haversineDistanceMeters(
        passengerLat,
        passengerLng,
        stop.latitude,
        stop.longitude,
      );

      const buses: StopBusInfo[] = [];
      if (stop.route?.buses) {
        for (const b of stop.route.buses) {
          const sim = fakeGpsService.getSimulation(b.id);
          let speed = 0;
          if (sim && sim.status === 'RUNNING') {
            speed = Math.round(sim.speed);
          } else if (b.locations.length > 0) {
            speed = Math.round(b.locations[0].speed || 0);
          }
          const isMoving = speed > 2;
          buses.push({
            id: b.id,
            busNumber: b.busNumber,
            plateNumber: b.plateNumber,
            direction: `To ${stop.route.destination}`,
            routeName: stop.route.name,
            speed,
            isMoving,
            motionStatus: isMoving ? 'MOVING' : 'PARKED',
          });
        }
      }

      return {
        id: stop.id,
        name: stop.name,
        latitude: stop.latitude,
        longitude: stop.longitude,
        distanceMeters,
        routeId: stop.routeId,
        routeName: stop.route?.name || '',
        direction: stop.route?.destination ? `To ${stop.route.destination}` : '',
        buses,
      };
    });

    // Group and deduplicate by stop name, keeping the closest distance and merging buses
    const uniqueMap = new Map<
      string,
      {
        id: string;
        name: string;
        latitude: number;
        longitude: number;
        distanceMeters: number;
        availableBusNumbers: string[];
        buses: StopBusInfo[];
        directions: StopDirectionGroup[];
      }
    >();

    for (const item of stopsWithDistance) {
      const key = item.name.trim().toLowerCase();
      const existing = uniqueMap.get(key);
      if (!existing) {
        const busNumbers = Array.from(new Set(item.buses.map((b) => b.busNumber)));
        const dirMap = new Map<string, StopBusInfo[]>();
        for (const b of item.buses) {
          const arr = dirMap.get(b.direction) || [];
          arr.push(b);
          dirMap.set(b.direction, arr);
        }
        const directions: StopDirectionGroup[] = Array.from(dirMap.entries()).map(
          ([direction, buses]) => ({ direction, buses }),
        );

        uniqueMap.set(key, {
          id: item.id,
          name: item.name,
          latitude: item.latitude,
          longitude: item.longitude,
          distanceMeters: item.distanceMeters,
          availableBusNumbers: busNumbers,
          buses: item.buses,
          directions,
        });
      } else {
        if (item.distanceMeters < existing.distanceMeters) {
          existing.distanceMeters = item.distanceMeters;
        }
        // Merge buses and directions
        for (const b of item.buses) {
          if (!existing.buses.some((eb) => eb.id === b.id)) {
            existing.buses.push(b);
          }
          if (!existing.availableBusNumbers.includes(b.busNumber)) {
            existing.availableBusNumbers.push(b.busNumber);
          }
        }
        // Re-group directions
        const dirMap = new Map<string, StopBusInfo[]>();
        for (const b of existing.buses) {
          const arr = dirMap.get(b.direction) || [];
          arr.push(b);
          dirMap.set(b.direction, arr);
        }
        existing.directions = Array.from(dirMap.entries()).map(([direction, buses]) => ({
          direction,
          buses,
        }));
      }
    }

    const sortedStops = Array.from(uniqueMap.values()).sort(
      (a, b) => a.distanceMeters - b.distanceMeters,
    );

    const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : 10;
    const result = sortedStops.slice(0, isNaN(limit) ? 10 : limit);

    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

const createStopSchema = z.object({
  name: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  order: z.number().int().nonnegative(),
  routeId: z.string().min(1),
});

const updateStopSchema = createStopSchema.partial();

export const getAllStops = async (
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const stops = await prisma.busStop.findMany({
      orderBy: [{ routeId: 'asc' }, { order: 'asc' }],
    });
    sendSuccess(res, { stops });
  } catch (err) { next(err); }
};

export const getStopById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const stop = await prisma.busStop.findUnique({ where: { id: req.params['id'] as string } });
    if (!stop) throw new AppError('Bus stop not found', 404);
    sendSuccess(res, { stop });
  } catch (err) { next(err); }
};

export const createStop = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = createStopSchema.parse(req.body);
    const route = await prisma.route.findUnique({ where: { id: input.routeId } });
    if (!route) throw new AppError('Route not found', 404);

    const stop = await prisma.busStop.create({ data: input });
    sendCreated(res, { stop });
  } catch (err) { next(err); }
};

export const updateStop = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = updateStopSchema.parse(req.body);
    const id = req.params['id'] as string;
    const stop = await prisma.busStop.findUnique({ where: { id } });
    if (!stop) throw new AppError('Bus stop not found', 404);

    const updated = await prisma.busStop.update({ where: { id }, data: input });
    sendSuccess(res, { stop: updated });
  } catch (err) { next(err); }
};

export const deleteStop = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const stop = await prisma.busStop.findUnique({ where: { id } });
    if (!stop) throw new AppError('Bus stop not found', 404);
    await prisma.busStop.delete({ where: { id } });
    sendSuccess(res, { message: 'Bus stop deleted' });
  } catch (err) { next(err); }
};
