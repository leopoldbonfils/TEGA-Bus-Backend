import prisma from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { Bus } from '@prisma/client';
import { routingService } from './routing.service';
import { Coordinate } from '../types';

export interface CreateRouteInput {
  name: string;
  startLocation: string;
  destination: string;
  fare: number;
  estimatedDuration: number;
}

export interface UpdateRouteInput extends Partial<CreateRouteInput> { }

const ROUTE_INCLUDE = {
  stops: { orderBy: { order: 'asc' as const } },
  buses: {
    select: {
      id: true,
      busNumber: true,
      status: true,
    },
  },
};

/**
 * Enriches a route record with real road geometry from OSRM
 */
const enrichRouteWithGeometry = async (route: any) => {
  if (!route.stops || route.stops.length < 2) {
    return {
      ...route,
      geometry: (route.stops || []).map((s: any) => ({
        latitude: s.latitude,
        longitude: s.longitude,
      })),
      distanceKm: 0,
    };
  }

  const geometryResult = await routingService.getRouteGeometry(route.stops, route.id);
  return {
    ...route,
    geometry: geometryResult.coordinates,
    distanceKm: geometryResult.distanceKm,
    estimatedDuration: geometryResult.durationMinutes || route.estimatedDuration,
  };
};

export const getAllRoutes = async () => {
  const routes = await prisma.route.findMany({
    include: ROUTE_INCLUDE,
    orderBy: { name: 'asc' },
  });

  return Promise.all(routes.map(enrichRouteWithGeometry));
};

export const getRouteById = async (id: string) => {
  const route = await prisma.route.findUnique({
    where: { id },
    include: ROUTE_INCLUDE,
  });
  if (!route) throw new AppError('Route not found', 404);
  return enrichRouteWithGeometry(route);
};

export const searchRoutes = async (from?: string, to?: string) => {
  const routes = await prisma.route.findMany({
    where: {
      AND: [
        from
          ? {
            OR: [
              { startLocation: { contains: from, mode: 'insensitive' } },
              { name: { contains: from, mode: 'insensitive' } },
            ],
          }
          : {},
        to
          ? {
            OR: [
              { destination: { contains: to, mode: 'insensitive' } },
              { name: { contains: to, mode: 'insensitive' } },
            ],
          }
          : {},
      ],
    },
    include: ROUTE_INCLUDE,
  });

  const enriched = await Promise.all(routes.map(enrichRouteWithGeometry));

  return enriched.map((route: any) => ({
    ...route,
    activeBusCount: route.buses.filter((b: Pick<Bus, 'status'>) => b.status === 'ON_TRIP').length,
  }));
};

export const createRoute = async (data: CreateRouteInput) => {
  const created = await prisma.route.create({ data, include: ROUTE_INCLUDE });

  const is109 =
    data.name.includes('109') ||
    (data.startLocation.toLowerCase().includes('nyabugogo') &&
      data.destination.toLowerCase().includes('remera'));

  if (is109) {
    const defaultStops = [
      { name: 'Nyabugogo Bus Park', latitude: -1.9355, longitude: 30.0540, order: 1 },
      { name: 'Kinamba Bridge', latitude: -1.9392, longitude: 30.0612, order: 2 },
      { name: 'Rwandex', latitude: -1.9567, longitude: 30.0815, order: 3 },
      { name: 'Sonatubes', latitude: -1.9612, longitude: 30.0965, order: 4 },
      { name: 'Remera Bus Park', latitude: -1.9502, longitude: 30.1073, order: 5 },
    ];

    await prisma.busStop.createMany({
      data: defaultStops.map((s) => ({
        ...s,
        routeId: created.id,
      })),
    });

    const reloaded = await prisma.route.findUnique({
      where: { id: created.id },
      include: ROUTE_INCLUDE,
    });

    if (reloaded) return enrichRouteWithGeometry(reloaded);
  }

  return enrichRouteWithGeometry(created);
};

export const updateRoute = async (id: string, data: UpdateRouteInput) => {
  await getRouteById(id);
  const updated = await prisma.route.update({ where: { id }, data, include: ROUTE_INCLUDE });
  return enrichRouteWithGeometry(updated);
};

export const deleteRoute = async (id: string) => {
  await getRouteById(id);
  return prisma.route.delete({ where: { id } });
};
