import { BusStatus, TripStatus } from '@prisma/client';

import prisma from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { fakeGpsService } from './fakeGps.service';

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
    where: {
      status: {
        in: [BusStatus.ACTIVE, BusStatus.ON_TRIP],
      },
    },
    include: {
      route: true,
      locations: {
        orderBy: { timestamp: 'desc' },
        take: 1,
      },
    },
    orderBy: {
      busNumber: 'asc',
    },
  });

  return buses.map((bus: typeof buses[number]) => ({
    id: bus.id,
    busNumber: bus.busNumber,
    routeId: bus.routeId || (bus.route ? bus.route.id : null),
    routeName: bus.route ? bus.route.name : null,
    status: bus.status,
    route: bus.route ? { name: bus.route.name } : null,
    location: bus.locations[0]
      ? {
          latitude: bus.locations[0].latitude,
          longitude: bus.locations[0].longitude,
        }
      : null,
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

function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
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

function extractRouteNumber(routeName: string): string | null {
  const match = routeName.match(/\b(\d{3})\b/);
  return match ? match[1] : null;
}

export interface NearbyBusQuery {
  passengerLat: number;
  passengerLng: number;
  destination?: string;
}

export interface RecommendedBus {
  id: string;
  busNumber: string;
  plateNumber: string;
  capacity: number;
  driverName: string;
  routeName: string;
  routeNumber: string;
  destination: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  currentStop: string;
  nextStop: string;
  distanceKm: number;
  distanceMeters: number;
  etaMinutes: number;
  status: string;
  isApproaching: boolean;
  isMoving: boolean;
  motionStatus: 'MOVING' | 'PARKED';
}

export interface UpcomingTripData {
  id: string;
  tripId?: string;
  routeNumber: string;
  routeName: string;
  destination: string;
  time: string;
  etaMinutes: number;
  status: 'Arriving' | 'Boarding' | 'Scheduled' | 'Departed';
  statusLabel: string;
  busNumber: string;
  plateNumber: string;
  driverName: string;
  currentStop: string;
  nextStop: string;
  isMoving: boolean;
  speed: number;
  distanceMeters: number;
}

export const getNearbyBusesForDestination = async ({
  passengerLat,
  passengerLng,
  destination,
}: NearbyBusQuery): Promise<RecommendedBus[]> => {
  const destTerm = destination ? destination.trim().toLowerCase() : null;

  const buses = await prisma.bus.findMany({
    where: {
      status: { in: [BusStatus.ACTIVE, BusStatus.ON_TRIP] },
    },
    include: {
      driver: {
        include: {
          user: { select: { name: true, phone: true } },
        },
      },
      route: {
        include: {
          stops: { orderBy: { order: 'asc' } },
        },
      },
      locations: {
        orderBy: { timestamp: 'desc' },
        take: 1,
      },
    },
  });

  const recommended: RecommendedBus[] = [];

  for (const bus of buses) {
    if (!bus.route || !bus.route.stops || bus.route.stops.length < 2) {
      continue;
    }

    const stops = bus.route.stops;

    // 1. Check if route serves destination (if destination is specified)
    let destStopIndex = -1;
    if (destTerm) {
      for (let i = stops.length - 1; i >= 0; i--) {
        const sName = stops[i].name.toLowerCase();
        if (sName.includes(destTerm)) {
          destStopIndex = i;
          break;
        }
      }

      if (destStopIndex === -1) {
        if (
          bus.route.destination.toLowerCase().includes(destTerm) ||
          bus.route.name.toLowerCase().includes(destTerm)
        ) {
          destStopIndex = stops.length - 1;
        } else {
          // Destination not served by this route corridor
          continue;
        }
      }
    } else {
      // General discovery: default destination is the route's terminus
      destStopIndex = stops.length - 1;
    }

    // 2. Find closest stop to passenger along this route
    let passengerStopIndex = 0;
    let minPassengerDist = Infinity;
    for (let i = 0; i < stops.length; i++) {
      const d = haversineDistanceKm(
        passengerLat,
        passengerLng,
        stops[i].latitude,
        stops[i].longitude,
      );
      if (d < minPassengerDist) {
        minPassengerDist = d;
        passengerStopIndex = i;
      }
    }

    // 3. Direction check: Destination stop must be AFTER the passenger stop (only when destination is searched)
    if (destTerm && destStopIndex <= passengerStopIndex) {
      // Traveling in the opposite direction or passenger already past destination
      continue;
    }

    // 4. Determine bus current position, speed, and stops
    const sim = fakeGpsService.getSimulation(bus.id);
    let busLat: number;
    let busLng: number;
    let busSpeed: number;
    let busHeading: number;
    let currentStopName: string;
    let nextStopName: string;

    if (sim && (sim.status === 'RUNNING' || sim.status === 'PAUSED')) {
      busLat = sim.currentPosition.latitude;
      busLng = sim.currentPosition.longitude;
      busSpeed = sim.speed;
      busHeading = sim.heading;
      currentStopName = sim.currentStop;
      nextStopName = sim.nextStop;
    } else if (bus.locations.length > 0) {
      busLat = bus.locations[0].latitude;
      busLng = bus.locations[0].longitude;
      busSpeed = bus.locations[0].speed || 0;
      busHeading = bus.locations[0].heading || 90;
      currentStopName = stops[passengerStopIndex]?.name || stops[0].name;
      nextStopName = stops[passengerStopIndex + 1]?.name || stops[stops.length - 1].name;
    } else {
      busLat = stops[0].latitude;
      busLng = stops[0].longitude;
      busSpeed = 0;
      busHeading = 90;
      currentStopName = stops[0].name;
      nextStopName = stops[1]?.name || stops[0].name;
    }

    // 5. Approaching check: Where is the bus relative to passenger's stop?
    let busStopIndex = 0;
    let minBusStopDist = Infinity;
    for (let i = 0; i < stops.length; i++) {
      const d = haversineDistanceKm(
        busLat,
        busLng,
        stops[i].latitude,
        stops[i].longitude,
      );
      if (d < minBusStopDist) {
        minBusStopDist = d;
        busStopIndex = i;
      }
    }

    const distToPassengerDirect = haversineDistanceKm(
      busLat,
      busLng,
      passengerLat,
      passengerLng,
    );

    // If destination search is active, and bus is past passenger stop and more than 200m away, it has already passed
    if (destTerm && busStopIndex > passengerStopIndex && distToPassengerDirect > 0.2) {
      continue;
    }

    // 6. Calculate Distance and ETA
    let distanceKm = Math.round(distToPassengerDirect * 10) / 10;
    if (distanceKm < 0.1) distanceKm = 0.1;

    const isMoving = busSpeed > 2;
    const motionStatus: 'MOVING' | 'PARKED' = isMoving ? 'MOVING' : 'PARKED';

    const speedForEta = busSpeed > 10 ? busSpeed : 25;
    const etaMinutes =
      distanceKm <= 0.2
        ? 1
        : Math.max(1, Math.round((distanceKm / speedForEta) * 60));

    const routeNum = extractRouteNumber(bus.route.name) || bus.busNumber;

    recommended.push({
      id: bus.id,
      busNumber: bus.busNumber,
      plateNumber: bus.plateNumber,
      capacity: bus.capacity,
      driverName: bus.driver?.user?.name || 'Jean Claude',
      routeName: bus.route.name,
      routeNumber: routeNum,
      destination: bus.route.destination,
      latitude: busLat,
      longitude: busLng,
      speed: Math.round(busSpeed),
      heading: busHeading,
      currentStop: currentStopName,
      nextStop: nextStopName,
      distanceKm,
      distanceMeters: Math.round(distanceKm * 1000),
      etaMinutes,
      status: bus.status,
      isApproaching: true,
      isMoving,
      motionStatus,
    });
  }

  // Sort by lowest ETA first
  return recommended.sort((a, b) => a.etaMinutes - b.etaMinutes);
};

export const getUpcomingTripForPassenger = async (
  passengerLat: number,
  passengerLng: number,
): Promise<UpcomingTripData | null> => {
  // 1. Check for ACTIVE trips first
  const activeTrips = await prisma.trip.findMany({
    where: { status: TripStatus.ACTIVE },
    include: {
      bus: {
        include: {
          driver: { include: { user: true } },
          locations: { orderBy: { timestamp: 'desc' }, take: 1 },
        },
      },
      route: {
        include: {
          stops: { orderBy: { order: 'asc' } },
        },
      },
      driver: { include: { user: true } },
    },
  });

  interface CandidateTrip {
    data: UpcomingTripData;
    etaMinutes: number;
    distanceMeters: number;
  }

  const candidates: CandidateTrip[] = [];

  for (const trip of activeTrips) {
    if (!trip.route || !trip.route.stops || trip.route.stops.length < 2) continue;
    const stops = trip.route.stops;

    // Find closest stop to passenger along this route
    let passengerStopIndex = 0;
    let minPassengerDist = Infinity;
    for (let i = 0; i < stops.length; i++) {
      const d = haversineDistanceKm(
        passengerLat,
        passengerLng,
        stops[i].latitude,
        stops[i].longitude,
      );
      if (d < minPassengerDist) {
        minPassengerDist = d;
        passengerStopIndex = i;
      }
    }

    // Bus position & telemetry
    const sim = fakeGpsService.getSimulation(trip.busId);
    let busLat: number;
    let busLng: number;
    let busSpeed: number;
    let currentStopName: string;
    let nextStopName: string;

    if (sim && (sim.status === 'RUNNING' || sim.status === 'PAUSED')) {
      busLat = sim.currentPosition.latitude;
      busLng = sim.currentPosition.longitude;
      busSpeed = sim.speed;
      currentStopName = sim.currentStop;
      nextStopName = sim.nextStop;
    } else if (trip.bus.locations && trip.bus.locations.length > 0) {
      busLat = trip.bus.locations[0].latitude;
      busLng = trip.bus.locations[0].longitude;
      busSpeed = trip.bus.locations[0].speed || 0;
      currentStopName = stops[0]?.name || 'Terminal';
      nextStopName = stops[1]?.name || stops[0]?.name || 'Terminal';
    } else {
      busLat = stops[0].latitude;
      busLng = stops[0].longitude;
      busSpeed = 0;
      currentStopName = stops[0].name;
      nextStopName = stops[1]?.name || stops[0].name;
    }

    // Determine where the bus is along route stops
    let busStopIndex = 0;
    let minBusDist = Infinity;
    for (let i = 0; i < stops.length; i++) {
      const d = haversineDistanceKm(busLat, busLng, stops[i].latitude, stops[i].longitude);
      if (d < minBusDist) {
        minBusDist = d;
        busStopIndex = i;
      }
    }

    const distToPassengerDirect = haversineDistanceKm(busLat, busLng, passengerLat, passengerLng);

    // ANTI-STUCK: If bus has passed the passenger stop by > 250m, it has departed!
    if (busStopIndex > passengerStopIndex && distToPassengerDirect > 0.25) {
      continue;
    }

    const distanceMeters = Math.round(distToPassengerDirect * 1000);
    const speedForEta = busSpeed > 10 ? busSpeed : 25;
    const etaMinutes =
      distanceMeters <= 150 ? 0 : Math.max(1, Math.round(((distanceMeters / 1000) / speedForEta) * 60));

    let status: 'Arriving' | 'Boarding' | 'Scheduled' | 'Departed' = 'Arriving';
    let statusLabel = `in ${etaMinutes} mins`;
    if (distanceMeters <= 150) {
      status = 'Boarding';
      statusLabel = 'At Stop';
    } else if (etaMinutes <= 1) {
      status = 'Arriving';
      statusLabel = 'in 1 min';
    }

    const routeNum = extractRouteNumber(trip.route.name) || trip.bus.busNumber;

    // Format current time / departure estimate
    const now = new Date();
    const arrTime = new Date(now.getTime() + etaMinutes * 60000);
    const hours = arrTime.getHours();
    const mins = arrTime.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;
    const formattedMins = mins < 10 ? `0${mins}` : mins;
    const timeStr = `${formattedHours}:${formattedMins} ${ampm}`;

    candidates.push({
      data: {
        id: trip.id,
        tripId: trip.id,
        routeNumber: routeNum,
        routeName: trip.route.name,
        destination: `To ${trip.route.destination}`,
        time: timeStr,
        etaMinutes,
        status,
        statusLabel,
        busNumber: trip.bus.busNumber,
        plateNumber: trip.bus.plateNumber,
        driverName: trip.driver?.user?.name || trip.bus.driver?.user?.name || 'Driver',
        currentStop: currentStopName,
        nextStop: nextStopName,
        isMoving: busSpeed > 2,
        speed: Math.round(busSpeed),
        distanceMeters,
      },
      etaMinutes,
      distanceMeters,
    });
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => a.etaMinutes - b.etaMinutes);
    return candidates[0].data;
  }

  // 2. If no approaching active trip, query scheduled trips from database
  const scheduledTrip = await prisma.trip.findFirst({
    where: { status: TripStatus.SCHEDULED },
    include: {
      bus: {
        include: {
          driver: { include: { user: true } },
          locations: { orderBy: { timestamp: 'desc' }, take: 1 },
        },
      },
      route: {
        include: {
          stops: { orderBy: { order: 'asc' } },
        },
      },
      driver: { include: { user: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (scheduledTrip && scheduledTrip.route) {
    const routeNum = extractRouteNumber(scheduledTrip.route.name) || scheduledTrip.bus.busNumber;
    return {
      id: scheduledTrip.id,
      tripId: scheduledTrip.id,
      routeNumber: routeNum,
      routeName: scheduledTrip.route.name,
      destination: `To ${scheduledTrip.route.destination}`,
      time: 'Scheduled',
      etaMinutes: 15,
      status: 'Scheduled',
      statusLabel: 'Scheduled',
      busNumber: scheduledTrip.bus.busNumber,
      plateNumber: scheduledTrip.bus.plateNumber,
      driverName: scheduledTrip.driver?.user?.name || scheduledTrip.bus.driver?.user?.name || 'Assigned Driver',
      currentStop: scheduledTrip.route.startLocation,
      nextStop: scheduledTrip.route.stops[1]?.name || scheduledTrip.route.destination,
      isMoving: false,
      speed: 0,
      distanceMeters: 1500,
    };
  }

  // 3. Fallback to closest active bus from database
  const nearbyBuses = await getNearbyBusesForDestination({ passengerLat, passengerLng });
  if (nearbyBuses.length > 0) {
    const topBus = nearbyBuses[0];
    const now = new Date();
    const arrTime = new Date(now.getTime() + topBus.etaMinutes * 60000);
    const hours = arrTime.getHours();
    const mins = arrTime.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;
    const formattedMins = mins < 10 ? `0${mins}` : mins;
    const timeStr = `${formattedHours}:${formattedMins} ${ampm}`;

    return {
      id: topBus.id,
      routeNumber: topBus.routeNumber,
      routeName: topBus.routeName,
      destination: `To ${topBus.destination}`,
      time: timeStr,
      etaMinutes: topBus.etaMinutes,
      status: topBus.etaMinutes <= 1 ? 'Boarding' : 'Arriving',
      statusLabel: topBus.etaMinutes <= 1 ? 'At Stop' : `in ${topBus.etaMinutes} mins`,
      busNumber: topBus.busNumber,
      plateNumber: topBus.plateNumber,
      driverName: topBus.driverName,
      currentStop: topBus.currentStop,
      nextStop: topBus.nextStop,
      isMoving: topBus.isMoving,
      speed: topBus.speed,
      distanceMeters: topBus.distanceMeters,
    };
  }

  return null;
};
