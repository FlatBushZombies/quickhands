import { neon } from '@neondatabase/serverless';
import logger from '#config/logger.js';

const sql = neon(process.env.DATABASE_URL);

function transformNotification(row) {
  return {
    id: row.id,
    userId: row.user_id,
    jobId: row.job_id,
    message: row.message,
    read: row.read,
    createdAt: row.created_at,
  };
}

export async function createNotification({ userId, jobId, message }) {
  try {
    const result = await sql`
      INSERT INTO notifications (user_id, job_id, message, read, created_at)
      VALUES (${userId}, ${jobId}, ${message}, false, NOW())
      RETURNING *;
    `;
    const notif = transformNotification(result[0]);
    logger.info(`Notification created id=${notif.id} userId=${userId} jobId=${jobId}`);
    return notif;
  } catch (e) {
    logger.error('createNotification DB error', e);
    throw new Error('Failed to create notification');
  }
}

export async function getNotificationsByUserId(userId) {
  try {
    const result = await sql`
      SELECT * FROM notifications
      WHERE user_id = ${userId}
      ORDER BY created_at DESC;
    `;
    return result.map(transformNotification);
  } catch (e) {
    logger.error('getNotificationsByUserId DB error', e);
    throw new Error('Failed to fetch notifications');
  }
}

export async function getNotificationsByClerkId(clerkId) {
  try {
    const result = await sql`
      SELECT n.*
      FROM notifications n
      JOIN users u ON u.id = n.user_id
      WHERE u.clerk_id = ${clerkId}
      ORDER BY n.created_at DESC;
    `;
    return result.map(transformNotification);
  } catch (e) {
    logger.error('getNotificationsByClerkId DB error', e);
    throw new Error('Failed to fetch notifications by clerkId');
  }
}

export async function markNotificationRead(id) {
  try {
    const result = await sql`
      UPDATE notifications
      SET read = true
      WHERE id = ${id}
      RETURNING *;
    `;
    if (result.length === 0) return null;
    const notif = transformNotification(result[0]);
    logger.info(`Notification marked read id=${id}`);
    return notif;
  } catch (e) {
    logger.error('markNotificationRead DB error', e);
    throw new Error('Failed to mark notification as read');
  }
}

export async function markAllNotificationsReadByClerkId(clerkId) {
  try {
    const result = await sql`
      UPDATE notifications n
      SET read = true
      WHERE n.read = false AND n.user_id IN (
        SELECT id FROM users WHERE clerk_id = ${clerkId}
      )
      RETURNING n.id;
    `;
    const count = result.length;
    logger.info(`Marked ${count} notifications read for clerkId=${clerkId}`);
    return count;
  } catch (e) {
    logger.error('markAllNotificationsReadByClerkId DB error', e);
    throw new Error('Failed to mark notifications as read by clerkId');
  }
}
