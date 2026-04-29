import express from 'express';
import {
  createOrRegisterUser,
  deleteMyJobTemplate,
  getMyJobTemplates,
  getUserProfileByClerkId,
  getUserProfileByQuery,
  getUserReviews,
  saveMyJobTemplate,
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
router.get('/:clerkId/reviews', getUserReviews);
router.get('/:clerkId', getUserProfileByClerkId);
router.post('/update', updateUserOnboarding);
router.patch('/location', requireAuth, updateUserLocation);

export default router;
