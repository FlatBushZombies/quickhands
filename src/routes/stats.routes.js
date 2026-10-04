import express from "express";
import { getPublicStatsController } from "#controllers/stats.controller.js";

const router = express.Router();

router.get("/public", getPublicStatsController);

export default router;
