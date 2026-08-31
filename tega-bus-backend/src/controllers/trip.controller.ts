import { Response, NextFunction } from 'express';
import * as tripService from '../services/trip.service';
import * as driverService from '../services/driver.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { AuthenticatedRequest } from '../types';

export const getAllTrips = async (
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const trips = await tripService.getAllTrips();
    sendSuccess(res, { trips });
  } catch (err) { next(err); }
};

export const getTripById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const trip = await tripService.getTripById(req.params['id'] as string);
    sendSuccess(res, { trip });
  } catch (err) { next(err); }
};

export const getActiveTrips = async (
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const trips = await tripService.getActiveTrips();
    sendSuccess(res, { trips });
  } catch (err) { next(err); }
};

export const startTrip = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const driver = await driverService.getDriverByUserId(req.user!.userId);
    const trip = await tripService.startTrip(driver.id);
    sendCreated(res, { trip });
  } catch (err) { next(err); }
};

export const endTrip = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const driver = await driverService.getDriverByUserId(req.user!.userId);
    const trip = await tripService.endTrip(req.params['id'] as string, driver.id);
    sendSuccess(res, { trip });
  } catch (err) { next(err); }
};
