import 'dotenv/config';
import http from 'http';
import { Server as IOServer } from 'socket.io';

import app from './app';
import { env } from './config/env';
import prisma from './config/database';
import { socketService } from './services/socket.service';
import { registerTrackingHandlers } from './sockets/tracking.socket';
import { fakeGpsService } from './services/fakeGps.service';

const server = http.createServer(app);

// ─────────────────────────────────────────────
// Socket.IO
// ─────────────────────────────────────────────

const io = new IOServer(server, {
  cors: {
    origin: (origin, callback) => {
      callback(null, true);
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Initialize singleton socket service
socketService.init(io);

// Register event handlers
registerTrackingHandlers(io);

// ─────────────────────────────────────────────
// Graceful shutdown
// ─────────────────────────────────────────────

const shutdown = async (signal: string): Promise<void> => {
  console.log(`\n⚡ Received ${signal}. Shutting down gracefully...`);
  fakeGpsService.stopAll();
  await prisma.$disconnect();
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  console.error('💥 Unhandled Rejection:', reason);
  process.exit(1);
});

// ─────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────

const start = async (): Promise<void> => {
  try {
    await prisma.$connect();
    console.log('✅ Database connected');

    server.listen(env.PORT, () => {
      console.log(`\n🚌 TEGA Bus Backend`);
      console.log(`🌍 Server running on http://localhost:${env.PORT}`);
      console.log(`🔌 Socket.IO ready`);
      console.log(`🌱 Environment: ${env.NODE_ENV}`);
      console.log(`📡 Fake GPS interval: ${env.FAKE_GPS_INTERVAL}ms`);
      console.log(`⏰ Started at: ${new Date().toISOString()}\n`);
    });
  } catch (error) {
    console.error('💥 Failed to start server:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
};

start();
