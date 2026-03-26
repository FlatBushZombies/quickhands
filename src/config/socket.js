import { Server as SocketIOServer } from "socket.io";
import { verifyToken } from "@clerk/clerk-sdk-node";
import logger from "#config/logger.js";
import { socketCorsOrigin } from "#config/cors.js";
import {
  getConversationByIdForUser,
  saveConversationMessage,
} from "#services/messaging.service.js";

let ioInstance = null;
/** @type {Map<string, Set<string>>} clerk user id -> socket ids */
const userSockets = new Map();

/** RFC 4122 UUID (versions 1–5), used for conversations (v5 DMs) and client ids */
const UUID_ANY =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === "string" && UUID_ANY.test(value);
}

const MAX_MESSAGE_LENGTH = 8000;

function roomNameForConversation(conversationId) {
  return `conv:${conversationId}`;
}

export function initSocket(httpServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: socketCorsOrigin(),
      methods: ["GET", "POST", "OPTIONS"],
      credentials: true,
    },
    transports: ["polling", "websocket"],
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.use(async (socket, next) => {
    const token =
      socket.handshake.auth?.token ?? socket.handshake.query?.token;

    if (token) {
      try {
        const payload = await verifyToken(String(token), {
          secretKey: process.env.CLERK_SECRET_KEY,
        });
        socket.data.clerkUserId = payload.sub;
        socket.data.userName = payload.name || payload.email || null;
        return next();
      } catch (e) {
        logger.warn(`Socket JWT rejected: ${e.message}`);
        return next(new Error("invalid_auth_token"));
      }
    }

    if (process.env.ALLOW_SOCKET_QUERY_USER === "true") {
      const { userId } = socket.handshake.query || {};
      if (userId) {
        socket.data.clerkUserId = String(userId);
        logger.warn("Socket using query userId (ALLOW_SOCKET_QUERY_USER=true only)");
        return next();
      }
    }

    return next(new Error("missing_auth_token"));
  });

  io.on("connection", (socket) => {
    const uid = socket.data.clerkUserId ?? null;

    if (uid) {
      if (!userSockets.has(uid)) userSockets.set(uid, new Set());
      userSockets.get(uid).add(socket.id);
      logger.info(`Socket connected clerkUserId=${uid} socketId=${socket.id}`);
    } else {
      logger.warn("Socket connected without clerkUserId");
    }

    socket.on("join_conversation", async (payload, ack) => {
      if (!uid) {
        const err = {
          code: "UNAUTHORIZED",
          message: "Missing authenticated user",
        };
        if (typeof ack === "function") ack(err);
        return;
      }
      const conversationId = payload?.conversationId;
      if (!isUuid(conversationId)) {
        const err = {
          code: "INVALID_CONVERSATION",
          message: "conversationId must be a UUID",
        };
        if (typeof ack === "function") ack(err);
        return;
      }
      const conversation = await getConversationByIdForUser(conversationId, uid);
      if (!conversation) {
        const err = {
          code: "CONVERSATION_NOT_FOUND",
          message: "Conversation not found or not accessible",
        };
        if (typeof ack === "function") ack(err);
        return;
      }
      const room = roomNameForConversation(conversationId);
      socket.join(room);
      logger.info(`userId=${uid} joined ${room}`);
      if (typeof ack === "function") {
        ack(null, {
          conversationId,
          room,
          conversation,
        });
      }
    });

    socket.on("leave_conversation", (payload, ack) => {
      const conversationId = payload?.conversationId;
      if (!isUuid(conversationId)) {
        const err = {
          code: "INVALID_CONVERSATION",
          message: "conversationId must be a UUID",
        };
        if (typeof ack === "function") ack(err);
        return;
      }
      const room = roomNameForConversation(conversationId);
      socket.leave(room);
      logger.info(`userId=${uid ?? "?"} left ${room}`);
      if (typeof ack === "function") ack(null, { conversationId });
    });

    socket.on("send_message", async (payload, ack) => {
      if (!uid) {
        const err = {
          code: "UNAUTHORIZED",
          message: "Missing authenticated user",
        };
        if (typeof ack === "function") ack(err);
        return;
      }
      const conversationId = payload?.conversationId;
      const text = payload?.text;
      if (!isUuid(conversationId)) {
        const err = {
          code: "INVALID_CONVERSATION",
          message: "conversationId must be a UUID",
        };
        if (typeof ack === "function") ack(err);
        return;
      }
      if (typeof text !== "string" || text.trim().length === 0) {
        const err = {
          code: "INVALID_MESSAGE",
          message: "text must be a non-empty string",
        };
        if (typeof ack === "function") ack(err);
        return;
      }
      if (text.length > MAX_MESSAGE_LENGTH) {
        const err = {
          code: "MESSAGE_TOO_LONG",
          message: `text must be at most ${MAX_MESSAGE_LENGTH} characters`,
        };
        if (typeof ack === "function") ack(err);
        return;
      }
      const room = roomNameForConversation(conversationId);
      const clientMessageId = payload?.clientMessageId;
      try {
        const { message } = await saveConversationMessage({
          conversationId,
          senderClerkId: uid,
          senderName: socket.data.userName || null,
          text,
          clientMessageId:
            typeof clientMessageId === "string" && isUuid(clientMessageId)
              ? clientMessageId
              : null,
        });
        io.to(room).emit("message", message);
        if (typeof ack === "function") ack(null, message);
      } catch (e) {
        logger.warn(`send_message rejected: ${e.message}`);
        if (typeof ack === "function") {
          ack({
            code: "MESSAGE_REJECTED",
            message: e.message,
          });
        }
      }
    });

    socket.on("disconnect", () => {
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
  logger.info("Socket.IO initialized (Clerk JWT auth; messaging events)");
  return io;
}

export function getIO() {
  if (!ioInstance) {
    throw new Error("Socket.IO not initialized");
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
