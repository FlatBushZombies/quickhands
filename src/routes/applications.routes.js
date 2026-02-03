import express from "express";
import { getMyApplications, updateApplicationStatusController } from "#controllers/application.controller.js";
import { requireAuth } from "#middleware/clerk.middleware.js";

const router = express.Router();

// Get current user's applications (freelancer view)
router.get("/my", requireAuth, getMyApplications);

// Update application status (client accepting/rejecting)
router.patch("/:id/status", requireAuth, updateApplicationStatusController);

export default router;
