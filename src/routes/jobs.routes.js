import express from "express";
import { getJobs, getJob, createJobController, searchJobsController } from "#controllers/jobs.controller.js";
import { extractUserInfo, requireAuth } from "#middleware/clerk.middleware.js";

const router = express.Router();

router.get("/", getJobs);
router.get("/search", searchJobsController);
router.get("/:id", getJob);
router.post("/", requireAuth, createJobController);

export default router;