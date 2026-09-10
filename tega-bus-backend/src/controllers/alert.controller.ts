import { Request, Response, NextFunction } from 'express';
import { alertService, AlertType } from '../services/alert.service';
import { sendSuccess, sendCreated, sendError } from '../utils/response';
import { AuthenticatedRequest } from '../types';

const VALID_ALERT_TYPES = ['GENERAL','SERVICE_ALERT','BUS_APPROACHING','DELAY','ROUTE_UPDATE'] as const;

// POST /api/alerts ADMIN only

export const createAlert = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { title, message, type, routeId } = req.body as {
      title?: string;
      message?: string;
      type?: AlertType;
      routeId?: string;
    };

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      sendError(res, 'title is required', 400);
      return;
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      sendError(res, 'message is required', 400);
      return;
    }

    const validTypes = Object.values(VALID_ALERT_TYPES);
    const resolvedType: AlertType =
      type && validTypes.includes(type as AlertType) ? (type as AlertType) : 'GENERAL';

    const alert = await alertService.createAlert({
      title: title.trim(),
      message: message.trim(),
      type: resolvedType,
      routeId: routeId ?? undefined,
    });

    sendCreated(res, { alert });
  } catch (err) {
    next(err);
  }
};



export const getAlerts = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const limit = Math.min(Number(req.query['limit'] ?? 50), 100);
    const alerts = await alertService.getAlerts(limit);
    sendSuccess(res, { alerts });
  } catch (err) {
    next(err);
  }
};
