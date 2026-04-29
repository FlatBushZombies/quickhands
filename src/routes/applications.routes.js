import express from "express";
import {
  getMyApplications,
  getApplicationReviewsController,
  updateApplicationStatusController,
  getAllApplicationsController,
  getClientApplicationsController,
  shareApplicationContactController,
  acceptApplicationController,
  rejectApplicationController,
  submitApplicationReviewController,
  updateClientApplicationMetaController,
} from "#controllers/application.controller.js";
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
router.patch("/:id/accept", requireAuth, acceptApplicationController);
router.post("/:id/accept", requireAuth, acceptApplicationController);
router.patch("/:id/reject", requireAuth, rejectApplicationController);
router.post("/:id/reject", requireAuth, rejectApplicationController);
router.patch("/:id/contact", requireAuth, shareApplicationContactController);
router.post("/:id/contact", requireAuth, shareApplicationContactController);
router.patch("/:id/share-contact", requireAuth, shareApplicationContactController);
router.post("/:id/share-contact", requireAuth, shareApplicationContactController);
router.patch("/:id/contact/share", requireAuth, shareApplicationContactController);
router.post("/:id/contact/share", requireAuth, shareApplicationContactController);
router.patch("/:id/client-meta", requireAuth, updateClientApplicationMetaController);
router.get("/:id/reviews", requireAuth, getApplicationReviewsController);
router.post("/:id/reviews", requireAuth, submitApplicationReviewController);

export default router;
