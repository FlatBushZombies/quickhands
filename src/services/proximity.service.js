import logger from "#config/logger.js";
import { sql } from "#config/database.js";
import { notifyUser } from "#services/notifications.service.js";
import { calculateDistanceKm, hasCoordinates } from "#utils/location.js";
import { conversationIdForJobClerkPair } from "#utils/conversationId.js";

const NOTIFY_RADIUS_KM = 0.5;
const RESET_RADIUS_KM = 1.5;

/**
 * Checks a freelancer's newly-reported location against every job they've
 * been accepted for, and notifies the client once when the freelancer first
 * comes within NOTIFY_RADIUS_KM. Clears the debounce once they move back out
 * past RESET_RADIUS_KM so a later approach can notify again.
 */
export async function checkJobProximityForFreelancer(freelancerClerkId, freelancerLocation) {
  if (!freelancerClerkId || !hasCoordinates(freelancerLocation)) {
    return;
  }

  const rows = await sql`
    SELECT
      ja.id AS application_id,
      ja.proximity_notified_at,
      ja.freelancer_name,
      sr.id AS job_id,
      sr.clerk_id AS client_clerk_id,
      sr.service_type,
      sr.location_latitude,
      sr.location_longitude
    FROM job_applications ja
    JOIN service_request sr ON sr.id = ja.job_id
    WHERE ja.freelancer_clerk_id = ${freelancerClerkId}
      AND ja.status = 'accepted'
      AND sr.location_latitude IS NOT NULL
      AND sr.location_longitude IS NOT NULL;
  `;

  for (const row of rows) {
    const jobLocation = {
      latitude: Number(row.location_latitude),
      longitude: Number(row.location_longitude),
    };

    if (!hasCoordinates(jobLocation)) {
      continue;
    }

    const distanceKm = calculateDistanceKm(freelancerLocation, jobLocation);
    if (!Number.isFinite(distanceKm)) {
      continue;
    }

    const alreadyNotified = Boolean(row.proximity_notified_at);

    if (distanceKm <= NOTIFY_RADIUS_KM && !alreadyNotified) {
      try {
        await notifyUser({
          clerkId: row.client_clerk_id,
          jobId: row.job_id,
          message: `${row.freelancer_name || "Your freelancer"} is nearby your job site for "${row.service_type}".`,
          type: "proximity",
          conversationId: conversationIdForJobClerkPair(row.job_id, freelancerClerkId, row.client_clerk_id),
        });

        await sql`
          UPDATE job_applications
          SET proximity_notified_at = now()
          WHERE id = ${row.application_id};
        `;
      } catch (error) {
        logger.error("Failed to send proximity notification", error);
      }
    } else if (distanceKm > RESET_RADIUS_KM && alreadyNotified) {
      await sql`
        UPDATE job_applications
        SET proximity_notified_at = NULL
        WHERE id = ${row.application_id};
      `;
    }
  }
}
