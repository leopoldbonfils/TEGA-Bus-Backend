import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { BusStatus } from '@prisma/client';
import * as busService from '../services/bus.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { AppError } from '../middleware/error.middleware';
import { AuthenticatedRequest } from '../types';

const createBusSchema = z.object({
  busNumber: z.string().min(1),
  plateNumber: z.string().min(1),
  capacity: z.number().int().positive(),
  driverId: z.string().optional(),
  routeId: z.string().optional(),
});

const updateBusSchema = z.object({
  busNumber: z.string().optional(),
  plateNumber: z.string().optional(),
  capacity: z.number().int().positive().optional(),
  status: z.nativeEnum(BusStatus).optional(),
  driverId: z.string().nullable().optional(),
  routeId: z.string().nullable().optional(),
});

export const getAllBuses = async (
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const buses = await busService.getAllBuses();
    sendSuccess(res, { buses });
  } catch (err) { next(err); }
};

export const getActiveBuses = async (
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const buses = await busService.getActiveBuses();
    sendSuccess(res, buses);
  } catch (err) { next(err); }
};

export const getNearbyBuses = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const latStr = req.query['latitude'] as string | undefined;
    const lngStr = req.query['longitude'] as string | undefined;
    const destination = (req.query['destination'] as string | undefined) || '';

    if (!latStr || !lngStr) {
      throw new AppError('latitude and longitude query parameters are required', 400);
    }

    const passengerLat = parseFloat(latStr);
    const passengerLng = parseFloat(lngStr);

    if (isNaN(passengerLat) || isNaN(passengerLng)) {
      throw new AppError('Invalid latitude or longitude format', 400);
    }

    const buses = await busService.getNearbyBusesForDestination({
      passengerLat,
      passengerLng,
      destination,
    });

    sendSuccess(res, buses);
  } catch (err) {
    next(err);
  }
};

export const getUpcomingTrip = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const latStr = req.query['latitude'] as string | undefined;
    const lngStr = req.query['longitude'] as string | undefined;

    const passengerLat = latStr ? parseFloat(latStr) : -1.9346;
    const passengerLng = lngStr ? parseFloat(lngStr) : 30.0540;

    const trip = await busService.getUpcomingTripForPassenger(
      isNaN(passengerLat) ? -1.9346 : passengerLat,
      isNaN(passengerLng) ? 30.0540 : passengerLng,
    );

    sendSuccess(res, trip);
  } catch (err) {
    next(err);
  }
};

export const getBusById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const bus = await busService.getBusById(req.params['id'] as string);
    sendSuccess(res, { bus });
  } catch (err) { next(err); }
};

export const createBus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = createBusSchema.parse(req.body);
    const bus = await busService.createBus(input);
    sendCreated(res, { bus });
  } catch (err) { next(err); }
};

export const updateBus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = updateBusSchema.parse(req.body) as busService.UpdateBusInput;
    const bus = await busService.updateBus(req.params['id'] as string, input);
    sendSuccess(res, { bus });
  } catch (err) { next(err); }
};

export const deleteBus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await busService.deleteBus(req.params['id'] as string);
    sendSuccess(res, { message: 'Bus deleted' });
  } catch (err) { next(err); }
};

export const getBusLocation = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const location = await busService.getLatestBusLocation(req.params['id'] as string);
    sendSuccess(res, { location });
  } catch (err) { next(err); }
};

export const getBusLocationHistory = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const history = await busService.getBusLocationHistory(req.params['id'] as string);
    sendSuccess(res, { history });
  } catch (err) { next(err); }
};
