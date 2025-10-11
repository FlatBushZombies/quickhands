import { Server as SocketIOServer } from 'socket.io';
import logger from '#config/logger.js';

let ioInstance = null;
// Map of userId -> Set of socketIds
const userSockets = new Map();

export function initSocket(httpServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.CLIENT_ORIGIN || '*',
      methods: ['GET', 'POST', 'PATCH'],
    },
  });

  io.on('connection', (socket) => {
    // Expect userId as a query param, e.g. io('...',{ query: { userId: '123' }})
    const { userId } = socket.handshake.query || {};

    if (userId) {
      const uid = String(userId);
      if (!userSockets.has(uid)) userSockets.set(uid, new Set());
      userSockets.get(uid).add(socket.id);
      logger.info(`Socket connected for userId=${uid}, socketId=${socket.id}`);
    } else {
      logger.warn('Socket connected without userId');
    }

    socket.on('disconnect', () => {
      if (userId) {
        const uid = String(userId);
        const set = userSockets.get(uid);
        if (set) {
          set.delete(socket.id);
          if (set.size === 0) userSockets.delete(uid);
        }
        logger.info(`Socket disconnected for userId=${uid}, socketId=${socket.id}`);
      }
    });
  });

  ioInstance = io;
  logger.info('Socket.IO initialized');
  return io;
}

export function getIO() {
  if (!ioInstance) {
    throw new Error('Socket.IO not initialized');
  }
  return ioInstance;
}

export function emitToUser(userId, event, payload) {
  try {
    const uid = String(userId);
    const set = userSockets.get(uid);
    if (!set || set.size === 0) {
      logger.info(`No active sockets for userId=${uid}, skipping emit for event=${event}`);
      return;
    }
    for (const socketId of set) {
      getIO().to(socketId).emit(event, payload);
    }
    logger.info(`Emitted event=${event} to userId=${uid} on ${set.size} sockets`);
  } catch (e) {
    logger.error('emitToUser error', e);
  }
}