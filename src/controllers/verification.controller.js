import logger from "#config/logger.js";
import {
  getVerificationByClerkId,
  submitVerificationRequest,
  VERIFICATION_DOCUMENT_TYPES,
} from "#services/verification.service.js";

/** GET /api/verification/me */
export async function getMyVerification(req, res) {
  try {
    const clerkId = req.user?.clerkId;
    if (!clerkId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }
    const verification = await getVerificationByClerkId(clerkId);
    return res.status(200).json({ success: true, verification });
  } catch (error) {
    logger.error("Failed to load verification status:", error);
    return res.status(500).json({ success: false, message: "Failed to load verification status" });
  }
}

/** POST /api/verification  body: { documentType: "id" | "passport", consent: true } */
export async function submitMyVerification(req, res) {
  try {
    const clerkId = req.user?.clerkId;
    if (!clerkId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const { documentType, consent } = req.body || {};
    if (!VERIFICATION_DOCUMENT_TYPES.includes(documentType)) {
      return res.status(400).json({ success: false, message: "documentType must be id or passport" });
    }
    if (consent !== true) {
      return res.status(400).json({
        success: false,
        message: "Consent to identity verification is required",
      });
    }

    const verification = await submitVerificationRequest(clerkId, { documentType });
    if (!verification) {
      return res.status(409).json({ success: false, message: "You are already verified" });
    }
    return res.status(200).json({ success: true, verification });
  } catch (error) {
    logger.error("Failed to submit verification:", error);
    return res.status(500).json({ success: false, message: "Failed to submit verification" });
  }
}
