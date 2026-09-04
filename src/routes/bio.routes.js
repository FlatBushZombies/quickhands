import express from "express";
import {
  checkBioUsernameController,
  getMyBioController,
  getPublicBioController,
  updateMyBioController,
} from "#controllers/bio.controller.js";
import { requireAuth } from "#middleware/clerk.middleware.js";

const router = express.Router();

// Specific paths before the "/:username" catch-all.
router.get("/me", requireAuth, getMyBioController);
router.patch("/me", requireAuth, updateMyBioController);
router.get("/check/:username", requireAuth, checkBioUsernameController);

// Public — this is what quickhands-web renders, no login required.
router.get("/:username", getPublicBioController);

export default router;
