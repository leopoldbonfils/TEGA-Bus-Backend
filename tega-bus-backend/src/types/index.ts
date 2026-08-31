import { Request } from 'express';
import { Role } from '@prisma/client';

// ─────────────────────────────────────────────
// Auth types
// ─────────────────────────────────────────────

export interface JwtPayload {
  userId: string;
  role: Role;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

// ─────────────────────────────────────────────
// GPS / Location types
// ─────────────────────────────────────────────

export interface LocationPayload {
  busId: string;
  busNumber: string;
  /** Route database ID */
  routeId?: string;
  /** 3-digit route number string, e.g. "101", "202" */
  routeNumber?: string;
  /** Hex color for this route, e.g. "#2563EB" */
  routeColor?: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  timestamp: string;
}

export interface Coordinate {
  latitude: number;
  longitude: number;
  name?: string;
}

// ─────────────────────────────────────────────
// Stop progress types
// ─────────────────────────────────────────────

export interface StopProgress {
  currentStop: string | null;
  nextStop: string | null;
  remainingStops: string[];
  distanceToNextStopKm: number;
  estimatedArrivalMinutes: number;
}

// ─────────────────────────────────────────────
// API Response types
// ─────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: unknown;
}

// ─────────────────────────────────────────────
// Pagination
// ─────────────────────────────────────────────

export interface PaginationQuery {
  page?: number;
  limit?: number;
}
