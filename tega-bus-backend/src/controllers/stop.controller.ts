import { Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../config/database';
import { sendSuccess, sendCreated } from '../utils/response';
import { AppError } from '../middleware/error.middleware';
import { AuthenticatedRequest } from '../types';

const createStopSchema = z.object({
  name: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  order: z.number().int().nonnegative(),
  routeId: z.string().min(1),
});

const updateStopSchema = createStopSchema.partial();

export const getAllStops = async (
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const stops = await prisma.busStop.findMany({
      orderBy: [{ routeId: 'asc' }, { order: 'asc' }],
    });
    sendSuccess(res, { stops });
  } catch (err) { next(err); }
};

export const getStopById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const stop = await prisma.busStop.findUnique({ where: { id: req.params['id'] as string } });
    if (!stop) throw new AppError('Bus stop not found', 404);
    sendSuccess(res, { stop });
  } catch (err) { next(err); }
};

export const createStop = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = createStopSchema.parse(req.body);
    const route = await prisma.route.findUnique({ where: { id: input.routeId } });
    if (!route) throw new AppError('Route not found', 404);

    const stop = await prisma.busStop.create({ data: input });
    sendCreated(res, { stop });
  } catch (err) { next(err); }
};

export const updateStop = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = updateStopSchema.parse(req.body);
    const id = req.params['id'] as string;
    const stop = await prisma.busStop.findUnique({ where: { id } });
    if (!stop) throw new AppError('Bus stop not found', 404);

    const updated = await prisma.busStop.update({ where: { id }, data: input });
    sendSuccess(res, { stop: updated });
  } catch (err) { next(err); }
};

export const deleteStop = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const stop = await prisma.busStop.findUnique({ where: { id } });
    if (!stop) throw new AppError('Bus stop not found', 404);
    await prisma.busStop.delete({ where: { id } });
    sendSuccess(res, { message: 'Bus stop deleted' });
  } catch (err) { next(err); }
};
