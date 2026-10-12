import logger from "#config/logger.js";
import { sql } from "#config/database.js";
import { parseDbTimestamp } from "#utils/dbTimestamp.js";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MAX_SLOT_LOOKAHEAD_DAYS = 14;
const DEFAULT_SLOT_MINUTES = 60;
const MIN_NOTICE_MINUTES = 30;

function isValidTime(value) {
  return typeof value === "string" && TIME_RE.test(value);
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export async function getWeeklyAvailability(specialistClerkId) {
  const rows = await sql.query(
    `SELECT id, day_of_week, to_char(start_time, 'HH24:MI') AS start_time, to_char(end_time, 'HH24:MI') AS end_time
     FROM specialist_availability
     WHERE specialist_clerk_id = $1
     ORDER BY day_of_week ASC, start_time ASC`,
    [specialistClerkId]
  );
  return rows.map((row) => ({
    id: row.id,
    dayOfWeek: row.day_of_week,
    dayName: DAY_NAMES[row.day_of_week],
    startTime: row.start_time,
    endTime: row.end_time,
  }));
}

/**
 * Replaces the specialist's whole weekly schedule with `windows`
 * (`[{ dayOfWeek, startTime, endTime }]`, times as "HH:MM" 24h). Existing
 * appointments are untouched — removing a window a client has already
 * booked into does not cancel that booking.
 */
export async function setWeeklyAvailability(specialistClerkId, windows) {
  if (!Array.isArray(windows)) {
    throw new Error("windows must be an array");
  }
  if (windows.length > 50) {
    throw new Error("Too many availability windows");
  }

  for (const window of windows) {
    const dayOfWeek = Number(window.dayOfWeek);
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      throw new Error("dayOfWeek must be 0-6 (Sunday-Saturday)");
    }
    if (!isValidTime(window.startTime) || !isValidTime(window.endTime)) {
      throw new Error("startTime and endTime must be HH:MM (24h)");
    }
    if (toMinutes(window.endTime) <= toMinutes(window.startTime)) {
      throw new Error("endTime must be after startTime");
    }
  }

  await sql.query("DELETE FROM specialist_availability WHERE specialist_clerk_id = $1", [specialistClerkId]);

  for (const window of windows) {
    await sql.query(
      `INSERT INTO specialist_availability (specialist_clerk_id, day_of_week, start_time, end_time)
       VALUES ($1, $2, $3, $4)`,
      [specialistClerkId, Number(window.dayOfWeek), window.startTime, window.endTime]
    );
  }

  return getWeeklyAvailability(specialistClerkId);
}

/**
 * Open slots for a specialist between `fromDate` and `toDate` (inclusive,
 * "YYYY-MM-DD", clamped to MAX_SLOT_LOOKAHEAD_DAYS), each `slotMinutes` long.
 * A slot is open if it fits inside one of the specialist's weekly windows
 * for that day of week and does not overlap a confirmed appointment. Slots
 * starting less than MIN_NOTICE_MINUTES from now are excluded.
 */
export async function getOpenSlots({ specialistClerkId, fromDate, toDate, slotMinutes = DEFAULT_SLOT_MINUTES }) {
  const minutes = Number(slotMinutes) || DEFAULT_SLOT_MINUTES;
  if (minutes < 15 || minutes > 480) {
    throw new Error("slotMinutes must be between 15 and 480");
  }

  const start = fromDate ? new Date(`${fromDate}T00:00:00`) : new Date();
  const requestedEnd = toDate ? new Date(`${toDate}T23:59:59`) : null;
  const maxEnd = new Date(start.getTime() + MAX_SLOT_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);
  const end = requestedEnd && requestedEnd < maxEnd ? requestedEnd : maxEnd;

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    throw new Error("Invalid date range");
  }

  const windows = await getWeeklyAvailability(specialistClerkId);
  if (windows.length === 0) {
    return [];
  }

  const booked = await sql.query(
    `SELECT scheduled_start, scheduled_end FROM appointments
     WHERE specialist_clerk_id = $1 AND status = 'confirmed'
       AND scheduled_start < $3 AND scheduled_end > $2`,
    [specialistClerkId, start.toISOString(), end.toISOString()]
  );
  const bookedRanges = booked.map((row) => ({
    start: parseDbTimestamp(row.scheduled_start).getTime(),
    end: parseDbTimestamp(row.scheduled_end).getTime(),
  }));

  const earliestStart = Date.now() + MIN_NOTICE_MINUTES * 60 * 1000;
  const windowsByDay = new Map();
  for (const window of windows) {
    if (!windowsByDay.has(window.dayOfWeek)) windowsByDay.set(window.dayOfWeek, []);
    windowsByDay.get(window.dayOfWeek).push(window);
  }

  const slots = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);

  while (cursor <= end) {
    const dayWindows = windowsByDay.get(cursor.getDay()) || [];
    for (const window of dayWindows) {
      const dayStart = new Date(cursor);
      dayStart.setHours(0, toMinutes(window.startTime), 0, 0);
      const dayEnd = new Date(cursor);
      dayEnd.setHours(0, toMinutes(window.endTime), 0, 0);

      for (let slotStart = dayStart.getTime(); slotStart + minutes * 60 * 1000 <= dayEnd.getTime(); slotStart += minutes * 60 * 1000) {
        const slotEnd = slotStart + minutes * 60 * 1000;
        if (slotStart < start.getTime() || slotStart > end.getTime() || slotStart < earliestStart) continue;
        const overlapsBooking = bookedRanges.some((range) => slotStart < range.end && slotEnd > range.start);
        if (!overlapsBooking) {
          slots.push({ start: new Date(slotStart).toISOString(), end: new Date(slotEnd).toISOString() });
        }
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  slots.sort((left, right) => new Date(left.start).getTime() - new Date(right.start).getTime());
  return slots;
}

export async function hasAvailabilitySchedule(specialistClerkId) {
  const [row] = await sql.query(
    "SELECT 1 FROM specialist_availability WHERE specialist_clerk_id = $1 LIMIT 1",
    [specialistClerkId]
  );
  return Boolean(row);
}

export { MIN_NOTICE_MINUTES };

export function logAvailabilityError(action, error) {
  logger.error(`availability.service ${action} error:`, error.message);
}
