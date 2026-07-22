import express from "express";
import {
  getJobs,
  getJob,
  createJobController,
  searchJobsController,
  getRecommendedSpecialistsController,
} from "#controllers/jobs.controller.js";
import { applyToJob, getJobApplications } from "#controllers/application.controller.js";
import { requireAuth } from "#middleware/clerk.middleware.js";

const router = express.Router();

router.get("/", getJobs);
router.get("/search", searchJobsController);
router.get("/:id", getJob);
router.post("/", requireAuth, createJobController);
router.get("/:id/recommended-specialists", requireAuth, getRecommendedSpecialistsController);

// Application routes
router.post("/:id/apply", requireAuth, applyToJob);
router.get("/:id/applications", requireAuth, getJobApplications);

export default router;
