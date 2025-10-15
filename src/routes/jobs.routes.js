import express from "express";
import { getJobs, getJob, createJobController, searchJobsController } from "#controllers/jobs.controller.js";

const router = express.Router();

router.get("/", getJobs);
router.get("/search", searchJobsController);
router.get("/:id", getJob);
router.post("/", createJobController);

export default router;