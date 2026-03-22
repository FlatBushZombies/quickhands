import express from "express";
import {
  getMessagingUsers,
  getConversationWithUser,
} from "#controllers/messaging.controller.js";
import { requireAuth } from "#middleware/clerk.middleware.js";

const router = express.Router();

router.get("/users", requireAuth, getMessagingUsers);
router.get("/conversation-with/:otherClerkId", requireAuth, getConversationWithUser);

export default router;
