import express from 'express';
import { createOrRegisterUser, getUserProfileByClerkId, getUserProfileByQuery, updateUserOnboarding, updateUserLocation } from '#controllers/user.controller.js';
import { requireAuth } from '#middleware/clerk.middleware.js';

const router = express.Router();

router.post('/', createOrRegisterUser);
router.get('/get', getUserProfileByQuery);
router.get('/:clerkId', getUserProfileByClerkId);
router.post('/update', updateUserOnboarding);
router.patch('/location', requireAuth, updateUserLocation);

export default router;
