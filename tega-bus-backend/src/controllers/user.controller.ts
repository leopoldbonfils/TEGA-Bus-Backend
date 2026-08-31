import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import prisma from '../config/database';
import { hashPassword } from '../utils/password';
import { sendSuccess, sendCreated, sendNotFound } from '../utils/response';
import { AppError } from '../middleware/error.middleware';
import { AuthenticatedRequest } from '../types';

const USER_SAFE_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  createdAt: true,
  updatedAt: true,
};

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8),
  role: z.nativeEnum(Role).optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
});

export const getAllUsers = async (
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const users = await prisma.user.findMany({ select: USER_SAFE_SELECT });
    sendSuccess(res, { users });
  } catch (err) {
    next(err);
  }
};

export const getUserById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params['id'] as string },
      select: USER_SAFE_SELECT,
    });
    if (!user) { sendNotFound(res, 'User not found'); return; }
    sendSuccess(res, { user });
  } catch (err) {
    next(err);
  }
};

export const createUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = createUserSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new AppError('Email already in use', 409);

    const hashedPassword = await hashPassword(input.password);
    const user = await prisma.user.create({
      data: { ...input, password: hashedPassword },
      select: USER_SAFE_SELECT,
    });
    sendCreated(res, { user });
  } catch (err) {
    next(err);
  }
};

export const updateUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = updateUserSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.params['id'] as string },
      data: input,
      select: USER_SAFE_SELECT,
    });
    sendSuccess(res, { user });
  } catch (err) {
    next(err);
  }
};

export const deleteUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await prisma.user.delete({ where: { id: req.params['id'] as string } });
    sendSuccess(res, { message: 'User deleted' });
  } catch (err) {
    next(err);
  }
};
