import { Server as IOServer } from 'socket.io';

class SocketService {
  private io: IOServer | null = null;

  init(io: IOServer): void {
    this.io = io;
    console.log('🔌 SocketService initialized');
  }

  emit(event: string, data: unknown): void {
    if (!this.io) {
      console.warn('⚠️  SocketService not initialized. Cannot emit:', event);
      return;
    }
    this.io.emit(event, data);
  }

  emitToRoom(room: string, event: string, data: unknown): void {
    if (!this.io) return;
    this.io.to(room).emit(event, data);
  }

  getIO(): IOServer | null {
    return this.io;
  }
}

export const socketService = new SocketService();
