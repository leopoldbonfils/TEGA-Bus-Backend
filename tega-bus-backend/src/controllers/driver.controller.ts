import { Response, NextFunction } from 'express';
import { z } from 'zod';
import * as driverService from '../services/driver.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { AuthenticatedRequest } from '../types';
import { AppError } from '../middleware/error.middleware';

const createDriverSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8),
  driverNumber: z.string().min(1),
  licenseNumber: z.string().min(1),
});

const updateDriverSchema = z.object({
  driverNumber: z.string().optional(),
  licenseNumber: z.string().optional(),
  status: z.enum(['AVAILABLE', 'ON_TRIP', 'OFFLINE']).optional(),
});

export const getAllDrivers = async (
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const drivers = await driverService.getAllDrivers();
    sendSuccess(res, { drivers });
  } catch (err) { next(err); }
};

export const getDriverById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const driver = await driverService.getDriverById(req.params['id'] as string);
    sendSuccess(res, { driver });
  } catch (err) { next(err); }
};

export const getMyDriverProfile = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const driver = await driverService.getDriverByUserId(req.user!.userId);
    sendSuccess(res, { driver });
  } catch (err) { next(err); }
};

export const getMyTrips = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const driver = await driverService.getDriverByUserId(req.user!.userId);
    const trips = await driverService.getDriverTrips(driver.id);
    sendSuccess(res, { trips });
  } catch (err) { next(err); }
};

export const createDriver = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = createDriverSchema.parse(req.body);
    const driver = await driverService.createDriver(input);
    sendCreated(res, { driver });
  } catch (err) { next(err); }
};

export const updateDriver = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = updateDriverSchema.parse(req.body);

    // Drivers can only update their own profile
    if (req.user?.role === 'DRIVER') {
      const driver = await driverService.getDriverByUserId(req.user.userId);
      if (driver.id !== req.params['id']) {
        throw new AppError('You can only update your own profile', 403);
      }
    }

    const driver = await driverService.updateDriver(req.params['id'] as string, input);
    sendSuccess(res, { driver });
  } catch (err) { next(err); }
};
