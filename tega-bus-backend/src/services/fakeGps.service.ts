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

    // Micro-interpolate between road coordinates for 100% smooth GPS movement along curves
    const denseWaypoints = generateDenseWaypoints(routeGeometryResult.coordinates, 0.025);

    const initialPos = { ...denseWaypoints[0] };
    const firstStopName = orderedStops[0]?.name || 'Start';
    const nextStopName = orderedStops[1]?.name || 'Next Stop';
    const distToNext = haversineKm(initialPos, orderedStops[1]);
    const initSpeed = 26;
    const initEta = Math.max(1, Math.round((distToNext / initSpeed) * 60));

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
      waypoints: denseWaypoints,
      stops: orderedStops,
      currentPosition: initialPos,
      speed: initSpeed,
      heading:
        denseWaypoints.length > 1
          ? Math.round(bearingDeg(denseWaypoints[0], denseWaypoints[1]))
          : 90,
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
      `🚌 FakeGPS: Started Bus ${bus.busNumber} on Route ${routeNumber} along real roads (${denseWaypoints.length} road steps)`
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

    const updateIntervalMs = Math.round(
      (env.FAKE_GPS_INTERVAL || 2000) / sim.speedMultiplier
    );

    sim.interval = setInterval(() => {
      this.tick(busId).catch(console.error);
    }, updateIntervalMs);

    console.log(
      `▶ FakeGPS: Resumed Bus ${sim.busNumber} (Route ${sim.routeNumber}) from road step ${sim.currentWaypointIndex}/${sim.waypoints.length}`
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
   * Simulation Tick: Advance along real road network waypoints
   */
  private async tick(busId: string): Promise<void> {
    const sim = this.simulations.get(busId);
    if (!sim || sim.status !== 'RUNNING') return;

    // Check if reached destination
    if (sim.currentWaypointIndex >= sim.waypoints.length - 1) {
      sim.isDestinationReached = true;
      sim.progress = 100;
      sim.speed = 0;
      sim.distanceToNextStopKm = 0;
      sim.etaMinutes = 0;
      sim.currentStop =
        sim.stops[sim.stops.length - 1]?.name || 'Destination';
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

    // Advance 1 road waypoint step
    const prevPos = { ...sim.currentPosition };
    sim.currentWaypointIndex += 1;
    const currentWaypoint = sim.waypoints[sim.currentWaypointIndex];
    sim.currentPosition = { ...currentWaypoint };

    // Calculate heading (bearing angle in degrees along actual road curve)
    const head = Math.round(bearingDeg(prevPos, sim.currentPosition));
    if (head >= 0 && head <= 360) {
      sim.heading = head;
    }

    // Realistic smooth speed (between 22 and 36 km/h)
    const baseSpeed = 28;
    const speedJitter = Math.sin(sim.currentWaypointIndex * 0.3) * 5;
    sim.speed = Math.max(18, Math.round(baseSpeed + speedJitter));

    // Calculate Trip Progress Percentage (0 - 100%)
    sim.progress = Math.min(
      99,
      Math.round((sim.currentWaypointIndex / (sim.waypoints.length - 1)) * 100)
    );

    // Determine current & next stop and calculate road-based remaining distance
    this.updateStopTelemetry(sim);

    // Persist to DB periodically (every ~5 seconds)
    const now = Date.now();
    if (now - sim.lastPersistTime > 4000) {
      sim.lastPersistTime = now;
      this.persistLocation(sim).catch(() => { });
    }

    // Broadcast location over Socket.IO to admin dashboard
    this.broadcastLocation(sim);
  }

  /**
   * Determine Current Stop, Next Stop, and calculate road-based remaining distance
   */
  private updateStopTelemetry(sim: SimulationState): void {
    if (!sim.stops || sim.stops.length === 0) return;

    let nextStopIdx = sim.stops.length - 1;

    // Look for next stop ahead of current position
    for (let i = 0; i < sim.stops.length; i++) {
      const stopFraction = i / (sim.stops.length - 1);
      const currFraction = sim.currentWaypointIndex / (sim.waypoints.length - 1);

      if (currFraction < stopFraction) {
        nextStopIdx = i;
        if (i > 0) {
          sim.currentStop = sim.stops[i - 1].name;
        }
        break;
      }
    }

    // Check if bus is close to a stop
    for (let i = 0; i < sim.stops.length; i++) {
      const stop = sim.stops[i];
      const distToStop = haversineKm(sim.currentPosition, stop);
      if (distToStop < 0.1) {
        sim.currentStop = stop.name;
        nextStopIdx = Math.min(i + 1, sim.stops.length - 1);
        break;
      }
    }

    const nextStopObj = sim.stops[nextStopIdx];
    sim.nextStop = nextStopObj ? nextStopObj.name : sim.stops[sim.stops.length - 1].name;

    // Calculate road distance along remaining waypoints to the next stop
    let remainingRoadDist = 0;
    const stopFraction = nextStopIdx / (sim.stops.length - 1);
    const stopTargetWpIdx = Math.round(stopFraction * (sim.waypoints.length - 1));

    for (let w = sim.currentWaypointIndex; w < stopTargetWpIdx && w < sim.waypoints.length - 1; w++) {
      remainingRoadDist += haversineKm(sim.waypoints[w], sim.waypoints[w + 1]);
    }

    if (remainingRoadDist === 0 && nextStopObj) {
      remainingRoadDist = haversineKm(sim.currentPosition, nextStopObj);
    }

    sim.distanceToNextStopKm = Math.max(0.1, Math.round(remainingRoadDist * 10) / 10);

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
