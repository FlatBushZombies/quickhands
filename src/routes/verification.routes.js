import express from "express";
import { getMyVerification, submitMyVerification } from "#controllers/verification.controller.js";
import { requireAuth } from "#middleware/clerk.middleware.js";

const router = express.Router();

router.get("/me", requireAuth, getMyVerification);
router.post("/", requireAuth, submitMyVerification);

export default router;
