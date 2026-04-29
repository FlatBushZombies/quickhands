import logger from "#config/logger.js";
import {
  listUsersForChat,
  getUserChatSummary,
} from "#services/user.service.js";
import {
  ensureDirectConversation,
  getOtherParticipant,
  listConversationsForUser,
  listMessagesForConversation,
  saveConversationMessage,
} from "#services/messaging.service.js";
import {
  buildCommunicationNotificationMessage,
} from "#utils/communicationCards.js";
import { notifyUser } from "#services/notifications.service.js";

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

    const conversation = await ensureDirectConversation({
      currentClerkId: me,
      currentUserName: req.user.userName,
      otherClerkId,
      otherUserName: other.displayName,
    });

    return res.status(200).json({
      success: true,
      conversationId: conversation.conversationId,
      conversation,
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

/**
 * GET /api/messaging/conversations?limit=
 * List conversations for the current Clerk user.
 */
export async function getMyConversations(req, res) {
  try {
    const conversations = await listConversationsForUser(req.user.clerkId, {
      limit: req.query.limit,
    });

    return res.status(200).json({
      success: true,
      conversations,
    });
  } catch (error) {
    logger.error("getMyConversations:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to list conversations",
    });
  }
}

/**
 * GET /api/messaging/conversations/:conversationId/messages?limit=&before=
 * Return message history for a conversation the current user belongs to.
 */
export async function getConversationMessages(req, res) {
  try {
    const { conversationId } = req.params;
    const result = await listMessagesForConversation(
      conversationId,
      req.user.clerkId,
      {
        limit: req.query.limit,
        before: req.query.before,
      }
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    return res.status(200).json({
      success: true,
      conversation: result.conversation,
      messages: result.messages,
    });
  } catch (error) {
    logger.error("getConversationMessages:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load messages",
    });
  }
}

/**
 * POST /api/messaging/conversations/:conversationId/messages
 * Persist a status card update for a conversation.
 */
export async function postConversationMessage(req, res) {
  try {
    const { conversationId } = req.params;
    const { text, tag, note, label, clientMessageId } = req.body || {};
    const result = await saveConversationMessage({
      conversationId,
      senderClerkId: req.user.clerkId,
      senderName: req.user.userName,
      text,
      tag,
      note,
      label,
      clientMessageId,
    });

    const recipient = getOtherParticipant(result.conversation, req.user.clerkId);
    if (recipient) {
      if (result.conversation.jobId) {
        try {
          await notifyUser({
            clerkId: recipient.clerkId,
            jobId: result.conversation.jobId,
            message: buildCommunicationNotificationMessage({
              senderName: req.user.userName,
              conversation: result.conversation,
              text: result.message.text,
            }),
          });
        } catch (notificationError) {
          logger.error("postConversationMessage notification error:", notificationError);
        }
      }
    }

    return res.status(201).json({
      success: true,
      conversation: result.conversation,
      message: result.message,
      duplicate: result.duplicate,
    });
  } catch (error) {
    logger.error("postConversationMessage:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to send message",
    });
  }
}
