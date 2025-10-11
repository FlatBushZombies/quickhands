import express from 'express';
import { updateUserOnboarding } from '#controllers/user.controller.js';

const router = express.Router();

// POST /api/user/update
router.post('/update', updateUserOnboarding);

export default router;