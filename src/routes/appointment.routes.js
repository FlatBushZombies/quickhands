import express from "express";
import {
  cancelAppointmentController,
  completeAppointmentController,
  createAppointmentController,
  getMyAppointmentsController,
} from "#controllers/appointment.controller.js";
import { requireAuth } from "#middleware/clerk.middleware.js";

const router = express.Router();

router.post("/", requireAuth, createAppointmentController);
router.get("/me", requireAuth, getMyAppointmentsController);
router.patch("/:id/cancel", requireAuth, cancelAppointmentController);
router.patch("/:id/complete", requireAuth, completeAppointmentController);

export default router;
