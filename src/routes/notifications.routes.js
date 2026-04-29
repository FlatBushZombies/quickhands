import express from "express";
import {
  getUserNotifications,
  getUserNotificationsByClerkId,
  markNotificationAsRead,
  markNotificationsReadByClerkId,
} from "#controllers/notifications.controller.js";

const router = express.Router();

router.get("/by-clerk/:clerkId", getUserNotificationsByClerkId);
router.patch("/by-clerk/:clerkId/read", markNotificationsReadByClerkId);
router.get("/:userId", getUserNotifications);
router.patch("/:id/read", markNotificationAsRead);

export default router;
