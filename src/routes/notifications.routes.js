import express from 'express';
import { getUserNotifications, markNotificationAsRead, getUserNotificationsByClerkId, markNotificationsReadByClerkId } from '#controllers/notifications.controller.js';

const router = express.Router();

// More specific ClerkID routes FIRST to avoid being shadowed by generic params
router.get('/by-clerk/:clerkId', getUserNotificationsByClerkId);
router.patch('/by-clerk/:clerkId/read', markNotificationsReadByClerkId);

// Generic numeric id routes AFTER
router.get('/:userId', getUserNotifications);
router.patch('/:id/read', markNotificationAsRead);

export default router;
