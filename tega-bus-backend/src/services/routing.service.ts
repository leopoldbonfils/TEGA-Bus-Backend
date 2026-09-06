import { Coordinate } from '../types';
import { ROUTE_WAYPOINTS } from './preloadedRoutes';

export interface RouteGeometryResult {
  coordinates: Coordinate[];
  distanceKm: number;
  durationMinutes: number;
}

function haversineDistKm(a: Coordinate, b: Coordinate): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const x = sinDLat * sinDLat + sinDLon * sinDLon * Math.cos(lat1) * Math.cos(lat2);
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function calcTotalDist(coords: Coordinate[]): number {
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    total += haversineDistKm(coords[i], coords[i + 1]);
  }
  return Math.round(total * 100) / 100;
}

class RoutingService {
  private cache = new Map<string, RouteGeometryResult>();
  private osrmBaseUrl = 'http://router.project-osrm.org/route/v1/driving';

  /**
   * Generates a cache key for an ordered list of stop coordinates
   */
  private generateCacheKey(stops: Array<{ latitude: number; longitude: number }>): string {
    return stops
      .map((s) => `${s.latitude.toFixed(5)},${s.longitude.toFixed(5)}`)
      .join(';');
  }

  /**
   * Fetch driving road geometry from OpenStreetMap OSRM Routing Engine
   * @param stops Ordered list of stops/waypoints
   * @param routeId Optional route ID for logging/caching
   */
  async getRouteGeometry(
    stops: Array<{ latitude: number; longitude: number; name?: string }>,
    routeId?: string
  ): Promise<RouteGeometryResult> {
    if (!stops || stops.length < 2) {
      return {
        coordinates: stops.map((s) => ({ latitude: s.latitude, longitude: s.longitude })),
        distanceKm: 0,
        durationMinutes: 0,
      };
    }

    // Determine route number if available
    let routeNum = '';
    if (routeId) {
      const match = routeId.match(/\b(\d{3})\b/);
      if (match) routeNum = match[1];
    }

    if (!routeNum && stops.length > 0) {
      const last = stops[stops.length - 1];
      const first = stops[0];
      // Check for Nyacyonga
      if (last.latitude < -1.86 && last.latitude > -1.88 && last.longitude > 30.07) {
        const isRidge = stops.some((s) => s.name?.includes('Gisozi') || s.name?.includes('Batsinda'));
        routeNum = isRidge ? '305' : '303';
      } else if (first.latitude < -1.86 && first.latitude > -1.88 && first.longitude > 30.07) {
        routeNum = '304';
      }
    }

    // If we have verified preloaded real Rwanda road geometry for this route, use it directly
    if (routeNum && ROUTE_WAYPOINTS[routeNum] && ROUTE_WAYPOINTS[routeNum].length > 0) {
      const roadCoords = ROUTE_WAYPOINTS[routeNum];
      const dist = calcTotalDist(roadCoords);
      console.log(
        `🛣️  RoutingService: Loaded pre-verified Rwanda road network geometry for Route ${routeNum} (${roadCoords.length} road coordinates, ${dist} km)`
      );
      return {
        coordinates: roadCoords,
        distanceKm: dist,
        durationMinutes: Math.max(15, Math.round((dist / 30) * 60)),
      };
    }

    const cacheKey = this.generateCacheKey(stops);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Format coordinates for OSRM: lon1,lat1;lon2,lat2;...
    const coordinatesString = stops
      .map((s) => `${s.longitude},${s.latitude}`)
      .join(';');

    const url = `${this.osrmBaseUrl}/${coordinatesString}?overview=full&geometries=geojson&steps=false`;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'TEGA-Bus-Kigali/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`OSRM HTTP error: ${response.status} ${response.statusText}`);
      }

      const data: any = await response.json();

      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        throw new Error(`OSRM Routing failed with code: ${data.code || 'No route found'}`);
      }

      const primaryRoute = data.routes[0];
      const rawGeoJsonCoords: [number, number][] = primaryRoute.geometry.coordinates;

      // Convert GeoJSON [longitude, latitude] -> Coordinate { latitude, longitude }
      const roadCoordinates: Coordinate[] = rawGeoJsonCoords.map(([lng, lat]) => ({
        latitude: lat,
        longitude: lng,
      }));

      const result: RouteGeometryResult = {
        coordinates: roadCoordinates,
        distanceKm: Math.round((primaryRoute.distance / 1000) * 100) / 100,
        durationMinutes: Math.round(primaryRoute.duration / 60),
      };

      this.cache.set(cacheKey, result);
      if (routeId) {
        this.cache.set(`route_${routeId}`, result);
      }

      console.log(
        `🛣️  RoutingService: Calculated real road route (${roadCoordinates.length} road coordinates, ${result.distanceKm} km) for ${routeId || 'stops'}`
      );

      return result;
    } catch (err: any) {
      console.warn(
        `⚠️ RoutingService: Failed to fetch OSRM route for ${routeId || 'stops'}: ${err.message}. Generating fine interpolation between stops.`
      );

      // Graceful fallback: interpolate densely between stops if network fails
      const fallbackCoords = this.denseInterpolate(stops);
      const fallbackResult: RouteGeometryResult = {
        coordinates: fallbackCoords,
        distanceKm: 10,
        durationMinutes: 30,
      };

      this.cache.set(cacheKey, fallbackResult);
      return fallbackResult;
    }
  }

  /**
   * Densely interpolate between control points as fallback
   */
  private denseInterpolate(stops: Array<{ latitude: number; longitude: number }>): Coordinate[] {
    const dense: Coordinate[] = [];
    for (let i = 0; i < stops.length - 1; i++) {
      const p1 = stops[i];
      const p2 = stops[i + 1];
      const steps = 25;
      for (let s = 0; s < steps; s++) {
        const frac = s / steps;
        dense.push({
          latitude: p1.latitude + (p2.latitude - p1.latitude) * frac,
          longitude: p1.longitude + (p2.longitude - p1.longitude) * frac,
        });
      }
    }
    dense.push(stops[stops.length - 1]);
    return dense;
  }
}

export const routingService = new RoutingService();
