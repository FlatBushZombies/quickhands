import logger from "#config/logger.js";
import {
  cancelAppointment,
  createAppointment,
  getAppointmentsForUser,
  markAppointmentCompleted,
} from "#services/appointment.service.js";

export async function createAppointmentController(req, res) {
  try {
    const appointment = await createAppointment({
      clientClerkId: req.user.clerkId,
      specialistClerkId: req.body?.specialistClerkId,
      serviceType: req.body?.serviceType,
      scheduledStart: req.body?.scheduledStart,
      scheduledEnd: req.body?.scheduledEnd,
      notes: req.body?.notes,
    });
    return res.status(201).json({ success: true, data: appointment });
  } catch (error) {
    logger.error("createAppointmentController error", error);
    return res.status(400).json({ success: false, message: error.message || "Failed to book appointment" });
  }
}

export async function getMyAppointmentsController(req, res) {
  try {
    const appointments = await getAppointmentsForUser(req.user.clerkId, {
      upcomingOnly: req.query.upcomingOnly === "true",
    });
    return res.status(200).json({ success: true, data: appointments });
  } catch (error) {
    logger.error("getMyAppointmentsController error", error);
    return res.status(500).json({ success: false, message: "Failed to load your appointments" });
  }
}

export async function cancelAppointmentController(req, res) {
  try {
    const appointment = await cancelAppointment(Number(req.params.id), req.user.clerkId);
    return res.status(200).json({ success: true, data: appointment });
  } catch (error) {
    logger.error("cancelAppointmentController error", error);
    return res.status(400).json({ success: false, message: error.message || "Failed to cancel appointment" });
  }
}

export async function completeAppointmentController(req, res) {
  try {
    const appointment = await markAppointmentCompleted(Number(req.params.id), req.user.clerkId);
    return res.status(200).json({ success: true, data: appointment });
  } catch (error) {
    logger.error("completeAppointmentController error", error);
    return res.status(400).json({ success: false, message: error.message || "Failed to mark appointment completed" });
  }
}
