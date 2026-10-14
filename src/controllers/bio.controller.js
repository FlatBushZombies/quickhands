import logger from "#config/logger.js";
import {
  getBioSettingsForClerkId,
  getPublicBioProfile,
  isUsernameTaken,
  normalizeUsername,
  updateBioSettings,
  validateUsernameFormat,
} from "#services/bio.service.js";
import { moderateText } from "#utils/contentModeration.js";

export async function getMyBioController(req, res) {
  try {
    const settings = await getBioSettingsForClerkId(req.user.clerkId);
    return res.status(200).json({ success: true, data: settings });
  } catch (error) {
    logger.error("getMyBioController error", error);
    return res.status(500).json({ success: false, message: "Failed to load your bio link settings" });
  }
}

export async function updateMyBioController(req, res) {
  try {
    const customLinks = Array.isArray(req.body?.customLinks) ? req.body.customLinks : [];
    const moderationText = [req.body?.tagline, ...customLinks.map((link) => link?.label)]
      .filter((value) => typeof value === "string")
      .join(" ");
    const moderation = moderateText(moderationText);
    if (!moderation.ok) {
      return res.status(400).json({ success: false, message: moderation.message });
    }

    const settings = await updateBioSettings(req.user.clerkId, {
      username: req.body?.username,
      tagline: req.body?.tagline,
      phone: req.body?.phone,
      smartLinks: req.body?.smartLinks,
      customLinks: req.body?.customLinks,
    });
    return res.status(200).json({ success: true, data: settings });
  } catch (error) {
    logger.error("updateMyBioController error", error);
    return res.status(400).json({ success: false, message: error.message || "Failed to save bio link settings" });
  }
}

export async function checkBioUsernameController(req, res) {
  try {
    const username = normalizeUsername(req.params.username);
    const formatError = validateUsernameFormat(username);
    if (formatError) {
      return res.status(200).json({ success: true, data: { available: false, reason: formatError } });
    }

    const taken = await isUsernameTaken(username, req.user?.clerkId || null);
    return res.status(200).json({
      success: true,
      data: { available: !taken, reason: taken ? "That username is already taken" : null },
    });
  } catch (error) {
    logger.error("checkBioUsernameController error", error);
    return res.status(500).json({ success: false, message: "Failed to check username" });
  }
}

export async function getPublicBioController(req, res) {
  try {
    const profile = await getPublicBioProfile(req.params.username);
    if (!profile) {
      return res.status(404).json({ success: false, message: "This bio page doesn't exist" });
    }
    return res.status(200).json({ success: true, data: profile });
  } catch (error) {
    logger.error("getPublicBioController error", error);
    return res.status(500).json({ success: false, message: "Failed to load bio page" });
  }
}
