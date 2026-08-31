import { Response, NextFunction } from 'express';
import { z } from 'zod';
import * as routeService from '../services/route.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { AuthenticatedRequest } from '../types';

const createRouteSchema = z.object({
  name: z.string().min(1),
  startLocation: z.string().min(1),
  destination: z.string().min(1),
  fare: z.number().positive(),
  estimatedDuration: z.number().int().positive(),
});

const updateRouteSchema = createRouteSchema.partial();

export const getAllRoutes = async (
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const routes = await routeService.getAllRoutes();
    sendSuccess(res, { routes });
  } catch (err) { next(err); }
};

export const searchRoutes = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const from = req.query['from'] as string | undefined;
    const to = req.query['to'] as string | undefined;
    const routes = await routeService.searchRoutes(from, to);
    sendSuccess(res, { routes });
  } catch (err) { next(err); }
};

export const getRouteById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const route = await routeService.getRouteById(req.params['id'] as string);
    sendSuccess(res, { route });
  } catch (err) { next(err); }
};

export const createRoute = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = createRouteSchema.parse(req.body);
    const route = await routeService.createRoute(input);
    sendCreated(res, { route });
  } catch (err) { next(err); }
};

export const updateRoute = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = updateRouteSchema.parse(req.body);
    const route = await routeService.updateRoute(req.params['id'] as string, input);
    sendSuccess(res, { route });
  } catch (err) { next(err); }
};

export const deleteRoute = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await routeService.deleteRoute(req.params['id'] as string);
    sendSuccess(res, { message: 'Route deleted' });
  } catch (err) { next(err); }
};
