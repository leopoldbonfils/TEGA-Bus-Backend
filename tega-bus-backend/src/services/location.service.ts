import prisma from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { socketService } from './socket.service';
import { LocationPayload } from '../types';
import { BusStop } from '@prisma/client';

export interface CreateLocationInput {
  busId: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
}

function validateCoordinates(lat: number, lon: number): void {
  if (lat < -90 || lat > 90) throw new AppError('Invalid latitude (must be -90 to 90)', 400);
  if (lon < -180 || lon > 180) throw new AppError('Invalid longitude (must be -180 to 180)', 400);
}

function haversineKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const createLocation = async (input: CreateLocationInput) => {
  validateCoordinates(input.latitude, input.longitude);

  const bus = await prisma.bus.findUnique({
    where: { id: input.busId },
    select: { id: true, busNumber: true },
  });
  if (!bus) throw new AppError('Bus not found', 404);

  const location = await prisma.busLocation.create({ data: input });

  const payload: LocationPayload = {
    busId: bus.id,
    busNumber: bus.busNumber,
    latitude: location.latitude,
    longitude: location.longitude,
    speed: location.speed,
    heading: location.heading,
    timestamp: location.timestamp.toISOString(),
  };
  socketService.emit('bus:location', payload);

  return location;
};

export const getStopProgress = async (busId: string) => {
  const bus = await prisma.bus.findUnique({
    where: { id: busId },
    include: {
      route: {
        include: { stops: { orderBy: { order: 'asc' } } },
      },
      locations: {
        orderBy: { timestamp: 'desc' },
        take: 1,
      },
    },
  });

  if (!bus) throw new AppError('Bus not found', 404);
  if (!bus.route) throw new AppError('Bus has no assigned route', 400);
  if (bus.locations.length === 0) throw new AppError('No location data for this bus', 404);

  const stops = bus.route.stops;
  const current = bus.locations[0];

  if (stops.length === 0) {
    return {
      currentStop: null,
      nextStop: null,
      remainingStops: [],
      distanceToNextStopKm: 0,
      estimatedArrivalMinutes: 0,
    };
  }

  let nearestIdx = 0;
  let minDist = Infinity;

  stops.forEach((stop: BusStop, idx: number) => {
    const d = haversineKm(current.latitude, current.longitude, stop.latitude, stop.longitude);
    if (d < minDist) {
      minDist = d;
      nearestIdx = idx;
    }
  });

  const nextIdx = nearestIdx + 1;
  const nextStop = stops[nextIdx] ?? null;

  const distToNext = nextStop
    ? haversineKm(current.latitude, current.longitude, nextStop.latitude, nextStop.longitude)
    : 0;

  const speed = current.speed > 0 ? current.speed : 20;
  const etaMinutes = nextStop ? Math.round((distToNext / speed) * 60) : 0;

  return {
    currentStop: stops[nearestIdx]?.name ?? null,
    nextStop: nextStop?.name ?? null,
    remainingStops: stops.slice(nextIdx + 1).map((s: BusStop) => s.name),
    distanceToNextStopKm: Math.round(distToNext * 100) / 100,
    estimatedArrivalMinutes: etaMinutes,
  };
};
