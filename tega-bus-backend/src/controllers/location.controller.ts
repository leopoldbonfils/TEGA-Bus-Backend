import { Response, NextFunction } from 'express';
import { z } from 'zod';
import * as locationService from '../services/location.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { AuthenticatedRequest } from '../types';

const locationSchema = z.object({
  busId: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  speed: z.number().min(0).max(300),
  heading: z.number().min(0).max(360),
});

export const createLocation = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = locationSchema.parse(req.body);
    const location = await locationService.createLocation(input);
    sendCreated(res, { location });
  } catch (err) { next(err); }
};

export const getBusLocation = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const progress = await locationService.getStopProgress(req.params['id'] as string);
    sendSuccess(res, progress);
  } catch (err) { next(err); }
};

export const getStopProgress = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const progress = await locationService.getStopProgress(req.params['id'] as string);
    sendSuccess(res, progress);
  } catch (err) { next(err); }
};
