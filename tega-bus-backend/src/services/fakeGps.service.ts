import prisma from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { socketService } from './socket.service';
import { routingService } from './routing.service';
import { env } from '../config/env';
import { LocationPayload, Coordinate } from '../types';
import { BusStatus } from '@prisma/client';

// Route colors broadcast with each telemetry payload
export const ROUTE_COLORS: Record<string, string> = {
  '101': '#2563EB', // Blue
  '202': '#EF4444', // Red
  '203': '#16A34A', // Green
  '204': '#7C3AED', // Purple
  '205': '#EA580C', // Orange
  '206': '#0D9488', // Teal
};

// ─────────────────────────────────────────────
// Geodesic Math Helpers
// ─────────────────────────────────────────────

export function haversineKm(a: Coordinate, b: Coordinate): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);

  const x =
    sinDLat * sinDLat + sinDLon * sinDLon * Math.cos(lat1) * Math.cos(lat2);
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function bearingDeg(a: Coordinate, b: Coordinate): number {
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Generate finely interpolated path with micro-steps along road coordinates
 */
function generateDenseWaypoints(
  rawPoints: Coordinate[],
  maxStepKm = 0.025
): Coordinate[] {
  if (rawPoints.length < 2) return rawPoints;
  const dense: Coordinate[] = [];
  for (let i = 0; i < rawPoints.length - 1; i++) {
    const p1 = rawPoints[i];
    const p2 = rawPoints[i + 1];
    dense.push(p1);

    const segDist = haversineKm(p1, p2);
    if (segDist > maxStepKm) {
      const steps = Math.ceil(segDist / maxStepKm);
      for (let s = 1; s < steps; s++) {
        const fraction = s / steps;
        dense.push({
          latitude: p1.latitude + (p2.latitude - p1.latitude) * fraction,
          longitude: p1.longitude + (p2.longitude - p1.longitude) * fraction,
        });
      }
    }
  }
  dense.push(rawPoints[rawPoints.length - 1]);
  return dense;
}

/** Extract route number (e.g. "101", "202") from a route name string */
function extractRouteNumber(routeName: string): string | null {
  const match = routeName.match(/\b(\d{3})\b/);
  return match ? match[1] : null;
}

// ─────────────────────────────────────────────
// Simulation Types & State
// ─────────────────────────────────────────────

export interface StopInfo {
  id?: string;
  name: string;
  latitude: number;
  longitude: number;
  order: number;
}

export interface RouteSegment {
  start: Coordinate;
  end: Coordinate;
  distanceMeters: number;
  cumulativeStartMeters: number;
  cumulativeEndMeters: number;
  bearing: number;
}

export function buildRouteSegments(waypoints: Coordinate[]): { segments: RouteSegment[]; totalDistanceMeters: number } {
  if (!waypoints || waypoints.length < 2) {
    return { segments: [], totalDistanceMeters: 0 };
  }

  const segments: RouteSegment[] = [];
  let cumulative = 0;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const start = waypoints[i];
    const end = waypoints[i + 1];
    const distMeters = haversineKm(start, end) * 1000;
    const bearing = Math.round(bearingDeg(start, end));
    const cumStart = cumulative;
    cumulative += distMeters;

    segments.push({
      start,
      end,
      distanceMeters: distMeters,
      cumulativeStartMeters: cumStart,
      cumulativeEndMeters: cumulative,
      bearing,
    });
  }

  return { segments, totalDistanceMeters: cumulative };
}

export function getPositionAtRouteDistance(
  segments: RouteSegment[],
  totalDistanceMeters: number,
  traveledDistanceMeters: number
): { position: Coordinate; heading: number; segmentIndex: number } {
  if (!segments || segments.length === 0) {
    return { position: { latitude: -1.9355, longitude: 30.0540 }, heading: 0, segmentIndex: 0 };
  }

  const targetDist = Math.max(0, Math.min(traveledDistanceMeters, totalDistanceMeters));

  let segIdx = 0;
  for (let i = 0; i < segments.length; i++) {
    if (targetDist <= segments[i].cumulativeEndMeters || i === segments.length - 1) {
      segIdx = i;
      break;
    }
  }

  const seg = segments[segIdx];
  const segDist = seg.distanceMeters;
  const offset = targetDist - seg.cumulativeStartMeters;
  const fraction = segDist > 0 ? Math.max(0, Math.min(1, offset / segDist)) : 0;

  const lat = seg.start.latitude + (seg.end.latitude - seg.start.latitude) * fraction;
  const lng = seg.start.longitude + (seg.end.longitude - seg.start.longitude) * fraction;

  return {
    position: { latitude: lat, longitude: lng },
    heading: seg.bearing,
    segmentIndex: segIdx,
  };
}

export interface SimulationState {
  busId: string;
  busNumber: string;
  routeId: string;
  routeNumber: string;
  routeColor: string;
  status: 'RUNNING' | 'PAUSED' | 'STOPPED';
  speedMultiplier: number;
  currentWaypointIndex: number;
  waypoints: Coordinate[];
  segments: RouteSegment[];
  totalDistanceMeters: number;
  traveledDistanceMeters: number;
  lastTickTime: number;
  stops: StopInfo[];
  currentPosition: Coordinate;
  speed: number;
  heading: number;
  currentStop: string;
  nextStop: string;
  distanceToNextStopKm: number;
  etaMinutes: number;
  progress: number;
  isDestinationReached: boolean;
  interval: ReturnType<typeof setInterval> | null;
  startedAt: string;
  lastPersistTime: number;
}

class FakeGpsService {
  private simulations = new Map<string, SimulationState>();

  isRunning(busId: string): boolean {
    const sim = this.simulations.get(busId);
    return sim?.status === 'RUNNING';
  }

  isPaused(busId: string): boolean {
    const sim = this.simulations.get(busId);
    return sim?.status === 'PAUSED';
  }

  getPublicState(sim: SimulationState) {
    return {
      busId: sim.busId,
      busNumber: sim.busNumber,
      routeId: sim.routeId,
      routeNumber: sim.routeNumber,
      routeColor: sim.routeColor,
      status: sim.status,
      running: sim.status === 'RUNNING',
      speedMultiplier: sim.speedMultiplier,
      currentPosition: sim.currentPosition,
      speed: sim.speed,
      heading: sim.heading,
      currentStop: sim.currentStop,
      nextStop: sim.nextStop,
      distanceToNextStopKm: sim.distanceToNextStopKm,
      etaMinutes: sim.etaMinutes,
      progress: sim.progress,
      isDestinationReached: sim.isDestinationReached,
      totalStops: sim.stops.length,
      startedAt: sim.startedAt,
    };
  }

  getStatus(busId: string) {
    const sim = this.simulations.get(busId);
    if (!sim) {
      return {
        running: false,
        status: 'STOPPED',
        isDestinationReached: false,
      };
    }
    return this.getPublicState(sim);
  }

  getSimulation(busId: string): SimulationState | undefined {
    return this.simulations.get(busId);
  }

  getAllSimulations(): Map<string, SimulationState> {
    return this.simulations;
  }

  /**
   * Start or Resume Simulation for a Bus
   */
  async start(busId: string, routeId?: string, speedMultiplier = 1) {
    const existing = this.simulations.get(busId);

    // If existing and PAUSED -> resume from exact position
    if (existing && existing.status === 'PAUSED') {
      return this.resume(busId);
    }

    // If already running -> update speedMultiplier if changed
    if (existing && existing.status === 'RUNNING') {
      if (speedMultiplier !== existing.speedMultiplier) {
        this.setSpeedMultiplier(busId, speedMultiplier);
      }
      return this.getPublicState(existing);
    }

    // Clean up any old stopped simulation
    if (existing?.interval) {
      clearInterval(existing.interval);
    }

    const bus = await prisma.bus.findUnique({
      where: { id: busId },
      include: {
        route: {
          include: { stops: { orderBy: { order: 'asc' } } },
        },
      },
    });

    if (!bus) throw new AppError('Bus not found', 404);

    const actualRouteId = routeId || bus.routeId;
    if (!actualRouteId) {
      throw new AppError('Bus has no assigned route', 400);
    }

    const route =
      bus.route && bus.route.id === actualRouteId
        ? bus.route
        : await prisma.route.findUnique({
          where: { id: actualRouteId },
          include: { stops: { orderBy: { order: 'asc' } } },
        });

    if (!route || route.stops.length < 2) {
      throw new AppError('Route has insufficient stops for GPS simulation', 400);
    }

    const orderedStops: StopInfo[] = route.stops.map((s, idx) => ({
      id: s.id,
      name: s.name,
      latitude: s.latitude,
      longitude: s.longitude,
      order: s.order || idx + 1,
    }));

    // ── Fetch Real Rwanda Road Network Coordinates from OSRM ─────────────
    const routeNumber = extractRouteNumber(route.name) || '';
    const routeGeometryResult = await routingService.getRouteGeometry(orderedStops, actualRouteId);

    console.log(
      `🛣️  FakeGPS: Loaded real Rwanda road geometry for Route ${routeNumber || route.name} (${routeGeometryResult.coordinates.length} road coordinates, ${routeGeometryResult.distanceKm} km)`
    );

    // Precalculate route segments for distance-based continuous movement
    const { segments, totalDistanceMeters } = buildRouteSegments(routeGeometryResult.coordinates);

    const initialPos = { ...routeGeometryResult.coordinates[0] };
    const firstStopName = orderedStops[0]?.name || 'Start';
    const nextStopName = orderedStops[1]?.name || 'Next Stop';
    const distToNext = haversineKm(initialPos, orderedStops[1]);
    const initSpeed = 28;
    const initEta = Math.max(1, Math.round((distToNext / initSpeed) * 60));
    const initHeading = segments.length > 0 ? segments[0].bearing : 90;

    const routeColor = ROUTE_COLORS[routeNumber] || '#2563EB';

    // Update bus status in DB to ON_TRIP
    await prisma.bus
      .update({
        where: { id: busId },
        data: { status: BusStatus.ON_TRIP },
      })
      .catch(() => { });

    const simState: SimulationState = {
      busId,
      busNumber: bus.busNumber,
      routeId: actualRouteId,
      routeNumber,
      routeColor,
      status: 'RUNNING',
      speedMultiplier: Math.max(0.5, speedMultiplier),
      currentWaypointIndex: 0,
      waypoints: routeGeometryResult.coordinates,
      segments,
      totalDistanceMeters,
      traveledDistanceMeters: 0,
      lastTickTime: Date.now(),
      stops: orderedStops,
      currentPosition: initialPos,
      speed: initSpeed,
      heading: initHeading,
      currentStop: firstStopName,
      nextStop: nextStopName,
      distanceToNextStopKm: Math.round(distToNext * 10) / 10,
      etaMinutes: initEta,
      progress: 0,
      isDestinationReached: false,
      interval: null,
      startedAt: new Date().toISOString(),
      lastPersistTime: 0,
    };

    // ── Emit full OSRM road geometry so frontend draws the EXACT road path ──
    // Use raw OSRM coordinates (not dense-interpolated) for the route polyline
    this.broadcastRouteGeometry(simState, routeGeometryResult.coordinates);

    // Emit initial starting location immediately
    this.broadcastLocation(simState);

    const updateIntervalMs = Math.round(
      (env.FAKE_GPS_INTERVAL || 2000) / simState.speedMultiplier
    );

    simState.interval = setInterval(() => {
      this.tick(busId).catch(console.error);
    }, updateIntervalMs);

    this.simulations.set(busId, simState);
    console.log(
      `🚌 FakeGPS: Started Bus ${bus.busNumber} on Route ${routeNumber} along real roads (${simState.segments.length} road segments)`
    );

    return this.getPublicState(simState);
  }

  /**
   * Pause Simulation (keep exact position)
   */
  pause(busId: string) {
    const sim = this.simulations.get(busId);
    if (!sim) return null;

    if (sim.interval) {
      clearInterval(sim.interval);
      sim.interval = null;
    }
    sim.status = 'PAUSED';
    sim.speed = 0;

    console.log(
      `⏸ FakeGPS: Paused Bus ${sim.busNumber} (Route ${sim.routeNumber}) at (${sim.currentPosition.latitude.toFixed(5)}, ${sim.currentPosition.longitude.toFixed(5)})`
    );

    this.broadcastLocation(sim);
    return this.getPublicState(sim);
  }

  /**
   * Resume Simulation from current paused position
   */
  resume(busId: string) {
    const sim = this.simulations.get(busId);
    if (!sim) {
      throw new AppError('No simulation exists for this bus to resume', 404);
    }

    if (sim.interval) {
      clearInterval(sim.interval);
      sim.interval = null;
    }

    sim.status = 'RUNNING';
    sim.speed = 28;
    sim.lastTickTime = Date.now();

    const updateIntervalMs = Math.round(
      (env.FAKE_GPS_INTERVAL || 2000) / sim.speedMultiplier
    );

    sim.interval = setInterval(() => {
      this.tick(busId).catch(console.error);
    }, updateIntervalMs);

    console.log(
      `▶ FakeGPS: Resumed Bus ${sim.busNumber} (Route ${sim.routeNumber}) from road distance ${Math.round(sim.traveledDistanceMeters)}m / ${Math.round(sim.totalDistanceMeters)}m`
    );

    this.broadcastLocation(sim);
    return this.getPublicState(sim);
  }

  /**
   * Stop and Reset Simulation
   */
  async stop(busId: string): Promise<void> {
    const sim = this.simulations.get(busId);
    if (!sim) return;

    if (sim.interval) {
      clearInterval(sim.interval);
    }

    sim.status = 'STOPPED';
    this.simulations.delete(busId);

    await prisma.bus
      .update({
        where: { id: busId },
        data: { status: BusStatus.ACTIVE },
      })
      .catch(() => { });

    console.log(
      `⏹ FakeGPS: Stopped simulation for Bus ${sim.busNumber} (Route ${sim.routeNumber})`
    );
  }

  /**
   * Set Simulation Speed Multiplier (0.5x, 1x, 2x, 5x)
   */
  setSpeedMultiplier(busId: string, multiplier: number) {
    const sim = this.simulations.get(busId);
    if (!sim) return null;

    sim.speedMultiplier = Math.max(0.5, multiplier);

    if (sim.status === 'RUNNING' && sim.interval) {
      clearInterval(sim.interval);
      const updateIntervalMs = Math.round(
        (env.FAKE_GPS_INTERVAL || 2000) / sim.speedMultiplier
      );
      sim.interval = setInterval(() => {
        this.tick(busId).catch(console.error);
      }, updateIntervalMs);
    }

    console.log(
      `⚡ FakeGPS: Speed multiplier for Bus ${sim.busNumber} set to ${multiplier}x`
    );
    return this.getPublicState(sim);
  }

  /**
   * Stop all running simulations
   */
  stopAll(): void {
    for (const [busId] of this.simulations) {
      this.stop(busId).catch(console.error);
    }
  }

  /**
   * Simulation Tick: Advance smoothly along real road network by exact distance
   */
  private async tick(busId: string): Promise<void> {
    const sim = this.simulations.get(busId);
    if (!sim || sim.status !== 'RUNNING') return;

    const now = Date.now();
    const deltaSec = sim.lastTickTime > 0 ? (now - sim.lastTickTime) / 1000 : 1.5;
    sim.lastTickTime = now;

    // Clamp deltaSec to prevent huge leaps from delays (Req 7)
    const clampedDelta = Math.min(Math.max(deltaSec, 0.05), 3.0);

    // Realistic smooth speed with subtle variation (24 - 32 km/h)
    const baseSpeed = 28;
    const speedJitter = Math.sin(sim.traveledDistanceMeters * 0.005) * 3;
    sim.speed = Math.max(22, Math.round(baseSpeed + speedJitter));

    // distanceToMove = speedInMetersPerSecond * deltaTime (Req 2 & 3)
    const speedMps = (sim.speed * 1000) / 3600;
    const distanceToMove = speedMps * clampedDelta * sim.speedMultiplier;

    sim.traveledDistanceMeters += distanceToMove;

    // Check if reached destination (Req 7)
    if (sim.traveledDistanceMeters >= sim.totalDistanceMeters) {
      sim.traveledDistanceMeters = sim.totalDistanceMeters;
      sim.isDestinationReached = true;
      sim.progress = 100;
      sim.speed = 0;
      sim.distanceToNextStopKm = 0;
      sim.etaMinutes = 0;
      sim.currentStop = sim.stops[sim.stops.length - 1]?.name || 'Destination';
      sim.nextStop = 'Destination Reached';
      sim.status = 'STOPPED';

      if (sim.interval) {
        clearInterval(sim.interval);
        sim.interval = null;
      }

      console.log(
        `🏁 FakeGPS: Bus ${sim.busNumber} arrived at final destination: ${sim.currentStop}!`
      );

      this.broadcastLocation(sim);
      await this.persistLocation(sim);
      return;
    }

    // Exact road coordinate & bearing from current route segment (Req 4, 5, 8, 9)
    const { position, heading, segmentIndex } = getPositionAtRouteDistance(
      sim.segments,
      sim.totalDistanceMeters,
      sim.traveledDistanceMeters
    );

    sim.currentPosition = position;
    sim.heading = heading;
    sim.currentWaypointIndex = segmentIndex;

    // Calculate Trip Progress Percentage (0 - 100%)
    sim.progress = Math.min(
      99,
      Math.round((sim.traveledDistanceMeters / sim.totalDistanceMeters) * 100)
    );

    // Determine current & next stop and calculate road-based remaining distance
    this.updateStopTelemetry(sim);

    // Persist to DB periodically (every ~5 seconds)
    if (now - sim.lastPersistTime > 4000) {
      sim.lastPersistTime = now;
      this.persistLocation(sim).catch(() => { });
    }

    // Broadcast location over Socket.IO
    this.broadcastLocation(sim);
  }

  /**
   * Determine Current Stop, Next Stop, and calculate road-based remaining distance
   */
  private updateStopTelemetry(sim: SimulationState): void {
    if (!sim.stops || sim.stops.length === 0) return;

    let nextStopIdx = sim.stops.length - 1;

    for (let i = 0; i < sim.stops.length; i++) {
      const stopFraction = i / (sim.stops.length - 1);
      const currFraction = sim.totalDistanceMeters > 0
        ? sim.traveledDistanceMeters / sim.totalDistanceMeters
        : 0;

      if (currFraction < stopFraction) {
        nextStopIdx = i;
        if (i > 0) {
          sim.currentStop = sim.stops[i - 1].name;
        }
        break;
      }
    }

    // Proximity check (< 120m to a stop)
    for (let i = 0; i < sim.stops.length; i++) {
      const stop = sim.stops[i];
      const distToStop = haversineKm(sim.currentPosition, stop);
      if (distToStop < 0.12) {
        sim.currentStop = stop.name;
        nextStopIdx = Math.min(i + 1, sim.stops.length - 1);
        break;
      }
    }

    const nextStopObj = sim.stops[nextStopIdx];
    sim.nextStop = nextStopObj ? nextStopObj.name : sim.stops[sim.stops.length - 1].name;

    // Remaining road distance
    const stopFraction = nextStopIdx / (sim.stops.length - 1);
    const stopTargetDistanceMeters = stopFraction * sim.totalDistanceMeters;
    const remainingMeters = Math.max(0, stopTargetDistanceMeters - sim.traveledDistanceMeters);
    sim.distanceToNextStopKm = Math.max(0.1, Math.round((remainingMeters / 1000) * 10) / 10);

    const speedForEta = sim.speed > 5 ? sim.speed : 25;
    sim.etaMinutes = Math.max(
      1,
      Math.round((sim.distanceToNextStopKm / speedForEta) * 60)
    );
  }

  /**
   * Broadcast Location to Socket.IO clients
   */
  private broadcastLocation(sim: SimulationState): void {
    const payload: LocationPayload & {
      routeNumber: string;
      routeColor: string;
      currentStop: string;
      nextStop: string;
      distanceKm: number;
      distanceToNextStopKm: number;
      etaMinutes: number;
      progress: number;
      tripProgress: number;
      isDestinationReached: boolean;
      simulationStatus: string;
      speedMultiplier: number;
    } = {
      busId: sim.busId,
      busNumber: sim.busNumber,
      routeId: sim.routeId,
      routeNumber: sim.routeNumber,
      routeColor: sim.routeColor,
      latitude: sim.currentPosition.latitude,
      longitude: sim.currentPosition.longitude,
      speed: sim.speed,
      heading: sim.heading,
      currentStop: sim.currentStop,
      nextStop: sim.nextStop,
      distanceKm: sim.distanceToNextStopKm,
      distanceToNextStopKm: sim.distanceToNextStopKm,
      etaMinutes: sim.etaMinutes,
      progress: sim.progress,
      tripProgress: sim.progress,
      isDestinationReached: sim.isDestinationReached,
      simulationStatus: sim.status,
      speedMultiplier: sim.speedMultiplier,
      timestamp: new Date().toISOString(),
    };

    socketService.emit('bus:location', payload);
    socketService.emit('bus:location:update', payload);
  }

  /**
   * Broadcast the OSRM road geometry for the route this bus is following.
   * Emitted once on simulation start so frontend draws the exact road path.
   */
  broadcastRouteGeometry(sim: SimulationState, rawCoordinates?: Coordinate[]): void {
    const coords = rawCoordinates || sim.waypoints;
    socketService.emit('bus:route:geometry', {
      busId: sim.busId,
      busNumber: sim.busNumber,
      routeId: sim.routeId,
      routeNumber: sim.routeNumber,
      routeColor: sim.routeColor,
      coordinates: coords.map((c) => [c.latitude, c.longitude] as [number, number]),
      stops: sim.stops.map((s) => ({
        name: s.name,
        latitude: s.latitude,
        longitude: s.longitude,
        order: s.order,
      })),
    });
  }

  /**
   * Sync active simulations & route geometries to a newly connected socket
   */
  syncToSocket(socket: { emit: (event: string, data: any) => void }): void {
    for (const sim of this.simulations.values()) {
      if (sim.status === 'RUNNING' || sim.status === 'PAUSED') {
        const coords = sim.waypoints;
        socket.emit('bus:route:geometry', {
          busId: sim.busId,
          busNumber: sim.busNumber,
          routeId: sim.routeId,
          routeNumber: sim.routeNumber,
          routeColor: sim.routeColor,
          coordinates: coords.map((c) => [c.latitude, c.longitude] as [number, number]),
          stops: sim.stops.map((s) => ({
            name: s.name,
            latitude: s.latitude,
            longitude: s.longitude,
            order: s.order,
          })),
        });

        socket.emit('bus:location', {
          busId: sim.busId,
          busNumber: sim.busNumber,
          routeId: sim.routeId,
          routeNumber: sim.routeNumber,
          routeColor: sim.routeColor,
          latitude: sim.currentPosition.latitude,
          longitude: sim.currentPosition.longitude,
          speed: sim.speed,
          heading: sim.heading,
          currentStop: sim.currentStop,
          nextStop: sim.nextStop,
          distanceKm: sim.distanceToNextStopKm,
          distanceToNextStopKm: sim.distanceToNextStopKm,
          etaMinutes: sim.etaMinutes,
          progress: sim.progress,
          tripProgress: sim.progress,
          isDestinationReached: sim.isDestinationReached,
          simulationStatus: sim.status,
          speedMultiplier: sim.speedMultiplier,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  /**
   * Save location to PostgreSQL
   */
  private async persistLocation(sim: SimulationState): Promise<void> {
    try {
      await prisma.busLocation.create({
        data: {
          busId: sim.busId,
          latitude: sim.currentPosition.latitude,
          longitude: sim.currentPosition.longitude,
          speed: sim.speed,
          heading: sim.heading,
        },
      });
    } catch {
      // Ignore transient storage errors during rapid simulation
    }
  }
}

export const fakeGpsService = new FakeGpsService();
