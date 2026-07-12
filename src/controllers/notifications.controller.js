import logger from "#config/logger.js";
import {
  getNotificationsByClerkId,
  getNotificationsByUserId,
  markAllNotificationsReadByClerkId,
  markNotificationRead,
} from "#services/notifications.service.js";

function parsePaginationQuery(query) {
  const opts = {};

  const limit = Number.parseInt(query.limit, 10);
  if (Number.isInteger(limit) && limit > 0) {
    opts.limit = limit;
  }

  const offset = Number.parseInt(query.offset, 10);
  if (Number.isInteger(offset) && offset >= 0) {
    opts.offset = offset;
  }

  return opts;
}

export async function getUserNotifications(req, res) {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const numericId = Number(userId);
    if (!Number.isInteger(numericId)) {
      return res.status(400).json({
        error:
          "userId must be a numeric internal ID. To fetch by Clerk ID, use /api/notifications/by-clerk/:clerkId",
      });
    }

    const notifications = await getNotificationsByUserId(
      numericId,
      parsePaginationQuery(req.query)
    );
    return res.status(200).json({ success: true, notifications });
  } catch (error) {
    logger.error("getUserNotifications error", error);
    return res.status(500).json({ error: "Failed to fetch notifications" });
  }
}

export async function getUserNotificationsByClerkId(req, res) {
  try {
    const { clerkId } = req.params;
    if (!clerkId) {
      return res.status(400).json({ error: "clerkId is required" });
    }

    const notifications = await getNotificationsByClerkId(
      clerkId,
      parsePaginationQuery(req.query)
    );
    return res.status(200).json({ success: true, notifications });
  } catch (error) {
    logger.error("getUserNotificationsByClerkId error", error);
    return res.status(500).json({ error: "Failed to fetch notifications by clerkId" });
  }
}

export async function markNotificationAsRead(req, res) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: "id is required" });
    }

    const notification = await markNotificationRead(id);
    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    return res.status(200).json({ success: true, notification });
  } catch (error) {
    logger.error("markNotificationAsRead error", error);
    return res.status(500).json({ error: "Failed to update notification" });
  }
}

export async function markNotificationsReadByClerkId(req, res) {
  try {
    const { clerkId } = req.params;
    if (!clerkId) {
      return res.status(400).json({ error: "clerkId is required" });
    }

    const updatedCount = await markAllNotificationsReadByClerkId(clerkId);
    return res.status(200).json({ success: true, updatedCount });
  } catch (error) {
    logger.error("markNotificationsReadByClerkId error", error);
    return res.status(500).json({ error: "Failed to update notifications by clerkId" });
  }
}
