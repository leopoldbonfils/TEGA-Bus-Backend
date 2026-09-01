import { Server as IOServer, Socket } from 'socket.io';

export const registerTrackingHandlers = (io: IOServer): void => {
  io.on('connection', (socket: Socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Passenger joins a bus tracking room
    socket.on('track:bus', (busId: string) => {
      socket.join(`bus:${busId}`);
      console.log(`👁  Client ${socket.id} tracking bus ${busId}`);
      socket.emit('track:bus:ack', { busId, message: 'Now tracking bus' });
    });

    // Passenger stop tracking a bus
    socket.on('untrack:bus', (busId: string) => {
      socket.leave(`bus:${busId}`);
      console.log(`🚪 Client ${socket.id} stopped tracking bus ${busId}`);
    });

    // Admin or Driver joins the general driver room
    socket.on('join:drivers', () => {
      socket.join('drivers');
      socket.emit('join:drivers:ack', { message: 'Joined drivers room' });
    });

    socket.on('disconnect', (reason) => {
      console.log(`🔌 Client disconnected: ${socket.id} — ${reason}`);
    });

    socket.on('error', (err) => {
      console.error(`Socket error [${socket.id}]:`, err);
    });
  });
};
