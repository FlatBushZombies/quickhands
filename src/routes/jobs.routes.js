import express from "express";
import { getJobs, createJobController } from "#controllers/jobs.controller.js";

const router = express.Router();

router.get("/", getJobs);
router.post("/", createJobController);

export default router;