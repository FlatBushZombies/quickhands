import express from "express";
import { getJobs, getJob, createJobController, searchJobsController } from "#controllers/jobs.controller.js";
import { applyToJob, getJobApplications } from "#controllers/application.controller.js";
import { requireAuth } from "#middleware/clerk.middleware.js";

const router = express.Router();

router.get("/", getJobs);
router.get("/search", searchJobsController);
router.get("/:id", getJob);
router.post("/", requireAuth, createJobController);

// Application routes
router.post("/:id/apply", applyToJob);
router.get("/:id/applications", requireAuth, getJobApplications);

export default router;
