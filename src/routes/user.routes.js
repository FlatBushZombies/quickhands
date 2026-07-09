import express from 'express';
import {
  createOrRegisterUser,
  deleteMyJobTemplate,
  getDeviceLocationToken,
  getMyJobTemplates,
  getUserProfileByClerkId,
  getUserProfileByQuery,
  getUserReviews,
  pingLocation,
  registerMyPushToken,
  saveMyJobTemplate,
  unregisterMyPushToken,
  updateUserOnboarding,
  updateUserLocation,
} from '#controllers/user.controller.js';
import { requireAuth } from '#middleware/clerk.middleware.js';

const router = express.Router();

router.post('/', createOrRegisterUser);
router.get('/get', getUserProfileByQuery);
router.get('/me/templates', requireAuth, getMyJobTemplates);
router.post('/me/templates', requireAuth, saveMyJobTemplate);
router.delete('/me/templates/:id', requireAuth, deleteMyJobTemplate);
router.patch('/me/push-token', requireAuth, registerMyPushToken);
router.delete('/me/push-token', requireAuth, unregisterMyPushToken);
router.get('/:clerkId/reviews', getUserReviews);
router.get('/:clerkId', getUserProfileByClerkId);
router.post('/update', updateUserOnboarding);
router.patch('/location', requireAuth, updateUserLocation);
router.post('/device-location-token', requireAuth, getDeviceLocationToken);
router.post('/location/ping', pingLocation);

export default router;
