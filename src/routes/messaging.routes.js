import express from "express";
import {
  getMessagingUsers,
  getConversationWithUser,
  getMyConversations,
  getConversationMessages,
  postConversationMessage,
} from "#controllers/messaging.controller.js";
import { requireAuth } from "#middleware/clerk.middleware.js";

const router = express.Router();

router.get("/users", requireAuth, getMessagingUsers);
router.get("/conversation-with/:otherClerkId", requireAuth, getConversationWithUser);
router.get("/conversations", requireAuth, getMyConversations);
router.get("/conversations/:conversationId/messages", requireAuth, getConversationMessages);
router.post("/conversations/:conversationId/messages", requireAuth, postConversationMessage);

export default router;
