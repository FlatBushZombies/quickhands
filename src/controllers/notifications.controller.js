import logger from '#config/logger.js';
import { getNotificationsByUserId, markNotificationRead, getNotificationsByClerkId, markAllNotificationsReadByClerkId } from '#services/notifications.service.js';

export async function getUserNotifications(req, res) {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Validate numeric userId to prevent Clerk IDs hitting this path
    const numericId = Number(userId);
    if (!Number.isInteger(numericId)) {
      return res.status(400).json({
        error: 'userId must be a numeric internal ID. To fetch by Clerk ID, use /api/notifications/by-clerk/:clerkId'
      });
    }

    const list = await getNotificationsByUserId(numericId);
    return res.status(200).json({ success: true, notifications: list });
  } catch (e) {
    logger.error('getUserNotifications error', e);
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
}

export async function getUserNotificationsByClerkId(req, res) {
  try {
    const { clerkId } = req.params;
    if (!clerkId) {
      return res.status(400).json({ error: 'clerkId is required' });
    }
    const list = await getNotificationsByClerkId(clerkId);
    return res.status(200).json({ success: true, notifications: list });
  } catch (e) {
    logger.error('getUserNotificationsByClerkId error', e);
    return res.status(500).json({ error: 'Failed to fetch notifications by clerkId' });
  }
}

export async function markNotificationAsRead(req, res) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'id is required' });
    }
    const updated = await markNotificationRead(id);
    if (!updated) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    return res.status(200).json({ success: true, notification: updated });
  } catch (e) {
    logger.error('markNotificationAsRead error', e);
    return res.status(500).json({ error: 'Failed to update notification' });
  }
}

export async function markNotificationsReadByClerkId(req, res) {
  try {
    const { clerkId } = req.params;
    if (!clerkId) {
      return res.status(400).json({ error: 'clerkId is required' });
    }
    const updatedCount = await markAllNotificationsReadByClerkId(clerkId);
    return res.status(200).json({ success: true, updatedCount });
  } catch (e) {
    logger.error('markNotificationsReadByClerkId error', e);
    return res.status(500).json({ error: 'Failed to update notifications by clerkId' });
  }
}
