import { Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { sendForbidden, sendUnauthorized } from '../utils/response';
import { AuthenticatedRequest } from '../types';

export const authorizeRoles = (...roles: Role[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendUnauthorized(res);
      return;
    }

    if (!roles.includes(req.user.role)) {
      sendForbidden(
        res,
        `Access denied. Required role: ${roles.join(' or ')}`,
      );
      return;
    }

    next();
  };
};
