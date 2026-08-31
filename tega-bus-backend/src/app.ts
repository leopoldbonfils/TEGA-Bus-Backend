import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { env } from './config/env';
import { errorHandler } from './middleware/error.middleware';

// Routes
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import busRoutes from './routes/bus.routes';
import driverRoutes from './routes/driver.routes';
import routeRoutes from './routes/route.routes';
import stopRoutes from './routes/stop.routes';
import tripRoutes from './routes/trip.routes';
import locationRoutes from './routes/location.routes';
import adminRoutes from './routes/admin.routes';

const app: Application = express();

// ─────────────────────────────────────────────
// Security & Logging
// ─────────────────────────────────────────────

app.use(helmet());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl) or any localhost/127.0.0.1/configured CLIENT_URL
      if (!origin || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1') || origin === env.CLIENT_URL) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

app.use(morgan(env.isDev ? 'dev' : 'combined'));

// ─────────────────────────────────────────────
// Body Parsing
// ─────────────────────────────────────────────

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// ─────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: '🚌 TEGA Bus API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    env: env.NODE_ENV,
  });
});

// ─────────────────────────────────────────────
// API Routes
// ─────────────────────────────────────────────

const API = '/api';

app.use(`${API}/auth`, authRoutes);
app.use(`${API}/users`, userRoutes);
app.use(`${API}/buses`, busRoutes);
app.use(`${API}/drivers`, driverRoutes);
app.use(`${API}/routes`, routeRoutes);
app.use(`${API}/stops`, stopRoutes);
app.use(`${API}/trips`, tripRoutes);
app.use(`${API}/locations`, locationRoutes);
app.use(`${API}/admin`, adminRoutes);

// ─────────────────────────────────────────────
// 404 Handler
// ─────────────────────────────────────────────

app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ─────────────────────────────────────────────
// Global Error Handler
// ─────────────────────────────────────────────

app.use(errorHandler);

export default app;
