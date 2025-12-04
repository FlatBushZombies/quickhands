import express from 'express';
import { createOrRegisterUser, getUserProfileByClerkId, updateUserOnboarding } from '#controllers/user.controller.js';

const router = express.Router();

// POST /api/user - initial creation from Clerk sign-up / OAuth
router.post('/', createOrRegisterUser);

// GET /api/user/:clerkId - fetch profile & onboarding state
router.get('/:clerkId', getUserProfileByClerkId);

// POST /api/user/update - onboarding/profile updates
router.post('/update', updateUserOnboarding);

export default router;