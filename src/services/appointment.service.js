import logger from "#config/logger.js";
import { sql } from "#config/database.js";
import { notifyUser } from "#services/notifications.service.js";
import { getUserByClerkId } from "#services/user.service.js";
import { dbTimestampToIso } from "#utils/dbTimestamp.js";

function transformAppointment(row) {
  return {
    id: row.id,
    specialistClerkId: row.specialist_clerk_id,
    clientClerkId: row.client_clerk_id,
    serviceType: row.service_type,
    scheduledStart: dbTimestampToIso(row.scheduled_start),
    scheduledEnd: dbTimestampToIso(row.scheduled_end),
    status: row.status,
    cancelledBy: row.cancelled_by,
    cancelledAt: dbTimestampToIso(row.cancelled_at),
    notes: row.notes,
    createdAt: dbTimestampToIso(row.created_at),
  };
}

/** True (23P01, Postgres exclusion_violation) when the slot was taken between the client reading it and booking it. */
function isSlotTakenError(error) {
  return error?.code === "23P01" || /appointments_no_overlap/.test(error?.message || "");
}

export async function createAppointment({ clientClerkId, specialistClerkId, serviceType, scheduledStart, scheduledEnd, notes }) {
  if (clientClerkId === specialistClerkId) {
    throw new Error("You can't book an appointment with yourself");
  }
  const start = new Date(scheduledStart);
  const end = new Date(scheduledEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    throw new Error("Invalid appointment time range");
  }
  if (start.getTime() < Date.now()) {
    throw new Error("That time has already passed");
  }

  const specialist = await getUserByClerkId(specialistClerkId);
  if (!specialist) {
    throw new Error("Specialist not found");
  }

  try {
    const [row] = await sql.query(
      `INSERT INTO appointments (specialist_clerk_id, client_clerk_id, service_type, scheduled_start, scheduled_end, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [specialistClerkId, clientClerkId, serviceType || null, start.toISOString(), end.toISOString(), notes || null]
    );

    const client = await getUserByClerkId(clientClerkId);
    await notifyUser({
      clerkId: specialistClerkId,
      jobId: null,
      type: "appointment_booked",
      message: `${client?.name || "A client"} booked an appointment with you for ${start.toLocaleString()}`,
    });

    return transformAppointment(row);
  } catch (error) {
    if (isSlotTakenError(error)) {
      throw new Error("That slot was just booked by someone else. Please pick another time.");
    }
    logger.error("createAppointment error:", error.message);
    throw error;
  }
}

/** Appointments where `clerkId` is either the client or the specialist. */
export async function getAppointmentsForUser(clerkId, { upcomingOnly = false } = {}) {
  const rows = await sql.query(
    `SELECT * FROM appointments
     WHERE (client_clerk_id = $1 OR specialist_clerk_id = $1)
       ${upcomingOnly ? "AND scheduled_end >= NOW() AND status = 'confirmed'" : ""}
     ORDER BY scheduled_start ASC`,
    [clerkId]
  );
  return rows.map(transformAppointment);
}

export async function cancelAppointment(appointmentId, cancellingClerkId) {
  const [existing] = await sql.query("SELECT * FROM appointments WHERE id = $1", [appointmentId]);
  if (!existing) {
    throw new Error("Appointment not found");
  }
  if (existing.client_clerk_id !== cancellingClerkId && existing.specialist_clerk_id !== cancellingClerkId) {
    throw new Error("You can only cancel your own appointments");
  }
  if (existing.status !== "confirmed") {
    throw new Error("Only a confirmed appointment can be cancelled");
  }

  const [row] = await sql.query(
    `UPDATE appointments SET status = 'cancelled', cancelled_by = $2, cancelled_at = NOW(), updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [appointmentId, cancellingClerkId]
  );

  const notifyClerkId = cancellingClerkId === existing.client_clerk_id ? existing.specialist_clerk_id : existing.client_clerk_id;
  await notifyUser({
    clerkId: notifyClerkId,
    jobId: null,
    type: "appointment_cancelled",
    message: `Your appointment for ${new Date(existing.scheduled_start).toLocaleString()} was cancelled`,
  });

  return transformAppointment(row);
}

export async function markAppointmentCompleted(appointmentId, specialistClerkId) {
  const [existing] = await sql.query("SELECT * FROM appointments WHERE id = $1", [appointmentId]);
  if (!existing) {
    throw new Error("Appointment not found");
  }
  if (existing.specialist_clerk_id !== specialistClerkId) {
    throw new Error("Only the specialist on this appointment can mark it completed");
  }
  if (existing.status !== "confirmed") {
    throw new Error("Only a confirmed appointment can be marked completed");
  }

  const [row] = await sql.query(
    "UPDATE appointments SET status = 'completed', updated_at = NOW() WHERE id = $1 RETURNING *",
    [appointmentId]
  );
  return transformAppointment(row);
}
