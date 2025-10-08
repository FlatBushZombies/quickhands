import express from "express";
import { getJobs, createJobController, searchJobsController } from "#controllers/jobs.controller.js";

const router = express.Router();

router.get("/", getJobs);
router.get("/search", searchJobsController);
router.post("/", createJobController);

export default router;