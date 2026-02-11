import express from "express";
import { getMyApplications, updateApplicationStatusController, getAllApplicationsController, getClientApplicationsController } from "#controllers/application.controller.js";
import { requireAuth } from "#middleware/clerk.middleware.js";

const router = express.Router();

// Debug endpoint - get all applications
router.get("/all", getAllApplicationsController);

// Get current user's applications (freelancer view)
router.get("/my", requireAuth, getMyApplications);

// Get applications for client's jobs (simplified)
router.get("/client", requireAuth, getClientApplicationsController);

// Update application status (client accepting/rejecting)
router.patch("/:id/status", requireAuth, updateApplicationStatusController);

export default router;
