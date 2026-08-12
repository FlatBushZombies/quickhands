import express from "express";
import {
  addMediaController,
  createProjectController,
  deleteProjectController,
  getMyPortfolioController,
  getSpecialistPortfolioController,
  recordPortfolioViewController,
  removeMediaController,
  reorderProjectsController,
  updateProjectController,
} from "#controllers/portfolio.controller.js";
import { requireAuth } from "#middleware/clerk.middleware.js";

const router = express.Router();

router.get("/me", requireAuth, getMyPortfolioController);

router.post("/projects", requireAuth, createProjectController);
router.patch("/projects/reorder", requireAuth, reorderProjectsController);
router.patch("/projects/:id", requireAuth, updateProjectController);
router.delete("/projects/:id", requireAuth, deleteProjectController);
router.post("/projects/:id/media", requireAuth, addMediaController);

router.delete("/media/:id", requireAuth, removeMediaController);

router.get("/:clerkId", requireAuth, getSpecialistPortfolioController);
router.post("/:clerkId/views", requireAuth, recordPortfolioViewController);

export default router;
