import express from "express";
import {
  getMyAvailabilityController,
  getSpecialistSlotsController,
  updateMyAvailabilityController,
} from "#controllers/availability.controller.js";
import { requireAuth } from "#middleware/clerk.middleware.js";

const router = express.Router();

router.get("/me", requireAuth, getMyAvailabilityController);
router.put("/me", requireAuth, updateMyAvailabilityController);
router.get("/:clerkId/slots", requireAuth, getSpecialistSlotsController);

export default router;
