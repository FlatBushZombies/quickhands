import logger from "#config/logger.js";
import {
  getOpenSlots,
  getWeeklyAvailability,
  setWeeklyAvailability,
} from "#services/availability.service.js";

export async function getMyAvailabilityController(req, res) {
  try {
    const windows = await getWeeklyAvailability(req.user.clerkId);
    return res.status(200).json({ success: true, data: windows });
  } catch (error) {
    logger.error("getMyAvailabilityController error", error);
    return res.status(500).json({ success: false, message: "Failed to load your availability" });
  }
}

export async function updateMyAvailabilityController(req, res) {
  try {
    const windows = await setWeeklyAvailability(req.user.clerkId, req.body?.windows || []);
    return res.status(200).json({ success: true, data: windows });
  } catch (error) {
    logger.error("updateMyAvailabilityController error", error);
    return res.status(400).json({ success: false, message: error.message || "Failed to save your availability" });
  }
}

export async function getSpecialistSlotsController(req, res) {
  try {
    const slots = await getOpenSlots({
      specialistClerkId: req.params.clerkId,
      fromDate: req.query.from,
      toDate: req.query.to,
      slotMinutes: req.query.slotMinutes ? Number(req.query.slotMinutes) : undefined,
    });
    return res.status(200).json({ success: true, data: slots });
  } catch (error) {
    logger.error("getSpecialistSlotsController error", error);
    return res.status(400).json({ success: false, message: error.message || "Failed to load available slots" });
  }
}
