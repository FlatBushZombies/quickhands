import logger from "#config/logger.js";
import {
  listUsersForChat,
  getUserChatSummary,
} from "#services/user.service.js";
import { conversationIdForClerkPair } from "#utils/conversationId.js";

/**
 * GET /api/messaging/users?q=&limit=
 * Bearer: Clerk session JWT
 */
export async function getMessagingUsers(req, res) {
  try {
    const clerkId = req.user.clerkId;
    const q = req.query.q;
    const limit = req.query.limit;
    const users = await listUsersForChat(clerkId, { q, limit });
    return res.status(200).json({ success: true, users });
  } catch (error) {
    logger.error("getMessagingUsers:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to list users",
    });
  }
}

/**
 * GET /api/messaging/conversation-with/:otherClerkId
 * Returns deterministic conversation UUID for a DM with another Clerk user.
 */
export async function getConversationWithUser(req, res) {
  try {
    const me = req.user.clerkId;
    const { otherClerkId } = req.params;

    if (!otherClerkId || typeof otherClerkId !== "string") {
      return res.status(400).json({
        success: false,
        message: "otherClerkId is required",
      });
    }

    if (otherClerkId === me) {
      return res.status(400).json({
        success: false,
        message: "Cannot start a conversation with yourself",
      });
    }

    const other = await getUserChatSummary(otherClerkId);
    if (!other) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const conversationId = conversationIdForClerkPair(me, otherClerkId);

    return res.status(200).json({
      success: true,
      conversationId,
      otherUser: other,
    });
  } catch (error) {
    logger.error("getConversationWithUser:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to resolve conversation",
    });
  }
}
