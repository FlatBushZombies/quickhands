import { Server as SocketIOServer } from 'socket.io';
import { randomUUID } from 'node:crypto';
import logger from '#config/logger.js';
import { socketCorsOrigin } from '#config/cors.js';

let ioInstance = null;
/** @type {Map<string, Set<string>>} userId -> socket ids */
const userSockets = new Map();

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuidV4(value) {
  return typeof value === 'string' && UUID_V4.test(value);
}

const MAX_MESSAGE_LENGTH = 8000;

function roomNameForConversation(conversationId) {
  return `conv:${conversationId}`;
}

export function initSocket(httpServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: socketCorsOrigin(),
      methods: ['GET', 'POST', 'OPTIONS'],
      credentials: true,
    },
    transports: ['polling', 'websocket'],
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.on('connection', (socket) => {
    const { userId } = socket.handshake.query || {};
    const uid = userId != null ? String(userId) : null;

    if (uid) {
      if (!userSockets.has(uid)) userSockets.set(uid, new Set());
      userSockets.get(uid).add(socket.id);
      logger.info(`Socket connected userId=${uid} socketId=${socket.id}`);
    } else {
      logger.warn('Socket connected without userId (query.userId)');
    }

    socket.on('join_conversation', (payload, ack) => {
      if (!uid) {
        const err = { code: 'UNAUTHORIZED', message: 'Missing userId on connection' };
        if (typeof ack === 'function') ack(err);
        return;
      }
      const conversationId = payload?.conversationId;
      if (!isUuidV4(conversationId)) {
        const err = { code: 'INVALID_CONVERSATION', message: 'conversationId must be a UUID v4' };
        if (typeof ack === 'function') ack(err);
        return;
      }
      const room = roomNameForConversation(conversationId);
      socket.join(room);
      logger.info(`userId=${uid} joined ${room}`);
      if (typeof ack === 'function') ack(null, { conversationId, room });
    });

    socket.on('leave_conversation', (payload, ack) => {
      const conversationId = payload?.conversationId;
      if (!isUuidV4(conversationId)) {
        const err = { code: 'INVALID_CONVERSATION', message: 'conversationId must be a UUID v4' };
        if (typeof ack === 'function') ack(err);
        return;
      }
      const room = roomNameForConversation(conversationId);
      socket.leave(room);
      logger.info(`userId=${uid ?? '?'} left ${room}`);
      if (typeof ack === 'function') ack(null, { conversationId });
    });

    socket.on('send_message', (payload, ack) => {
      if (!uid) {
        const err = { code: 'UNAUTHORIZED', message: 'Missing userId on connection' };
        if (typeof ack === 'function') ack(err);
        return;
      }
      const conversationId = payload?.conversationId;
      const text = payload?.text;
      if (!isUuidV4(conversationId)) {
        const err = { code: 'INVALID_CONVERSATION', message: 'conversationId must be a UUID v4' };
        if (typeof ack === 'function') ack(err);
        return;
      }
      if (typeof text !== 'string' || text.trim().length === 0) {
        const err = { code: 'INVALID_MESSAGE', message: 'text must be a non-empty string' };
        if (typeof ack === 'function') ack(err);
        return;
      }
      if (text.length > MAX_MESSAGE_LENGTH) {
        const err = {
          code: 'MESSAGE_TOO_LONG',
          message: `text must be at most ${MAX_MESSAGE_LENGTH} characters`,
        };
        if (typeof ack === 'function') ack(err);
        return;
      }
      const room = roomNameForConversation(conversationId);
      const clientMessageId = payload?.clientMessageId;
      const message = {
        id: randomUUID(),
        conversationId,
        senderId: uid,
        text: text.trim(),
        createdAt: new Date().toISOString(),
        ...(typeof clientMessageId === 'string' && isUuidV4(clientMessageId)
          ? { clientMessageId }
          : {}),
      };
      io.to(room).emit('message', message);
      if (typeof ack === 'function') ack(null, message);
    });

    socket.on('disconnect', () => {
      if (uid) {
        const set = userSockets.get(uid);
        if (set) {
          set.delete(socket.id);
          if (set.size === 0) userSockets.delete(uid);
        }
        logger.info(`Socket disconnected userId=${uid} socketId=${socket.id}`);
      }
    });
  });

  ioInstance = io;
  logger.info('Socket.IO initialized (messaging: join_conversation, send_message)');
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
    if (!ioInstance) {
      logger.warn(`Socket.IO not initialized, skipping emit for userId=${userId}`);
      return;
    }

    const uid = String(userId);
    const set = userSockets.get(uid);
    if (!set || set.size === 0) {
      logger.info(`No active sockets for userId=${uid}, skipping emit for event=${event}`);
      return;
    }

    for (const socketId of set) {
      ioInstance.to(socketId).emit(event, payload);
    }
    logger.info(`Emitted event=${event} to userId=${uid} on ${set.size} sockets`);
  } catch (e) {
    logger.warn(`emitToUser error (non-fatal): ${e.message}`);
  }
}
