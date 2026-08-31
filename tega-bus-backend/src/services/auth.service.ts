import { Role } from '@prisma/client';
import prisma from '../config/database';
import { hashPassword, comparePassword } from '../utils/password';
import { signToken } from '../utils/jwt';
import { AppError } from '../middleware/error.middleware';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface RegisterInput {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role?: Role;
}

export interface LoginInput {
  email: string;
  password: string;
}

const USER_SAFE_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  createdAt: true,
  updatedAt: true,
};

// ─────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────

export const registerUser = async (input: RegisterInput) => {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (existing) {
    throw new AppError('Email already in use', 409);
  }

  const hashedPassword = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      password: hashedPassword,
      role: input.role ?? Role.PASSENGER,
    },
    select: USER_SAFE_SELECT,
  });

  const token = signToken({ userId: user.id, role: user.role });
  return { user, token };
};

export const loginUser = async (input: LoginInput) => {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  const isMatch = await comparePassword(input.password, user.password);
  if (!isMatch) {
    throw new AppError('Invalid email or password', 401);
  }

  const { password: _pw, ...safeUser } = user;

  const token = signToken({ userId: safeUser.id, role: safeUser.role });
  return { user: safeUser, token };
};

export const getMe = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: USER_SAFE_SELECT,
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  return user;
};
