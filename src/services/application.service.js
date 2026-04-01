import logger from "#config/logger.js";
import { sql } from "#config/database.js";
import { conversationIdForJobClerkPair } from "#utils/conversationId.js";
import {
  isMissingApplicationContactColumnError,
  normalizePhoneNumber,
  transformApplication,
} from "#utils/applicationPresentation.js";

function trimOptionalString(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Create a new job application
 */
export async function createApplication(applicationData) {
  const {
    jobId,
    freelancerClerkId,
    freelancerName,
    freelancerEmail,
    quotation,
    conditions,
  } = applicationData;

  try {
    const existing = await sql`
      SELECT id FROM job_applications
      WHERE job_id = ${jobId}
      AND freelancer_clerk_id = ${freelancerClerkId}
      LIMIT 1;
    `;

    if (existing.length > 0) {
      throw new Error("You have already applied to this job");
    }

    let result;
    try {
      result = await sql`
        INSERT INTO job_applications (
          job_id,
          freelancer_clerk_id,
          freelancer_name,
          freelancer_email,
          quotation,
          conditions
        )
        VALUES (
          ${jobId},
          ${freelancerClerkId},
          ${freelancerName},
          ${freelancerEmail},
          ${quotation},
          ${conditions}
        )
        RETURNING *;
      `;
    } catch (insertError) {
      if (insertError.message.includes("column") || insertError.message.includes("does not exist")) {
        logger.warn("Quotation/conditions columns not found, inserting without them. Run migration!");
        result = await sql`
          INSERT INTO job_applications (
            job_id,
            freelancer_clerk_id,
            freelancer_name,
            freelancer_email
          )
          VALUES (
            ${jobId},
            ${freelancerClerkId},
            ${freelancerName},
            ${freelancerEmail}
          )
          RETURNING *;
        `;
      } else {
        throw insertError;
      }
    }

    logger.info(`Application created: id=${result[0].id}, jobId=${jobId}, freelancer=${freelancerClerkId}`);
    return transformApplication(result[0], { viewerRole: "freelancer" });
  } catch (error) {
    logger.error("Error creating application:", error);
    throw error;
  }
}

/**
 * Get all applications for a specific job
 */
export async function getApplicationsByJobId(jobId) {
  try {
    const result = await sql`
      SELECT
        a.*,
        sr.max_price as job_max_price,
        sr.created_at as job_created_at,
        sr.user_name as job_client_name
      FROM job_applications a
      JOIN service_request sr ON a.job_id = sr.id
      WHERE a.job_id = ${jobId}
      ORDER BY a.created_at DESC;
    `;

    logger.info(`Retrieved ${result.length} applications for job ${jobId}`);
    return result.map((app) => transformApplication(app, { viewerRole: "client" }));
  } catch (error) {
    logger.error(`Error fetching applications for job ${jobId}:`, error);
    throw error;
  }
}

export async function getApplicationCountByJobId(jobId) {
  try {
    const result = await sql`
      SELECT COUNT(*) AS total
      FROM job_applications
      WHERE job_id = ${jobId};
    `;

    return Number.parseInt(result[0]?.total, 10) || 0;
  } catch (error) {
    logger.error(`Error counting applications for job ${jobId}:`, error);
    throw error;
  }
}

/**
 * Get all applications by a freelancer
 */
export async function getApplicationsByFreelancerId(clerkId) {
  try {
    const result = await sql`
      SELECT
        a.*,
        sr.service_type as job_service_type,
        sr.max_price as job_max_price,
        sr.start_date as job_start_date,
        sr.end_date as job_end_date,
        sr.user_name as job_client_name,
        sr.clerk_id as job_client_clerk_id,
        sr.created_at as job_created_at
      FROM job_applications a
      JOIN service_request sr ON a.job_id = sr.id
      WHERE a.freelancer_clerk_id = ${clerkId}
      ORDER BY a.created_at DESC;
    `;

    logger.info(`Retrieved ${result.length} applications for freelancer ${clerkId}`);
    return result.map((app) => ({
      ...transformApplication(app, { viewerRole: "freelancer" }),
      conversationId: conversationIdForJobClerkPair(
        app.job_id,
        app.freelancer_clerk_id,
        app.job_client_clerk_id
      ),
      job: {
        serviceType: app.job_service_type,
        maxPrice: app.job_max_price,
        startDate: app.job_start_date,
        endDate: app.job_end_date,
        clientName: app.job_client_name,
        clientClerkId: app.job_client_clerk_id,
      },
    }));
  } catch (error) {
    logger.error(`Error fetching applications for freelancer ${clerkId}:`, error);
    throw error;
  }
}

/**
 * Update application status
 */
export async function updateApplicationStatus(applicationId, status) {
  const validStatuses = ["pending", "accepted", "rejected"];

  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status. Must be one of: ${validStatuses.join(", ")}`);
  }

  try {
    const result = await sql`
      UPDATE job_applications
      SET status = ${status}, updated_at = NOW()
      WHERE id = ${applicationId}
      RETURNING *;
    `;

    if (result.length === 0) {
      throw new Error("Application not found");
    }

    logger.info(`Application ${applicationId} status updated to ${status}`);
    return getApplicationById(applicationId, { viewerRole: "admin" });
  } catch (error) {
    logger.error(`Error updating application ${applicationId}:`, error);
    throw error;
  }
}

/**
 * Get application by ID
 */
export async function getApplicationById(applicationId, options = {}) {
  try {
    const result = await sql`
      SELECT
        a.*,
        sr.service_type as job_service_type,
        sr.max_price as job_max_price,
        sr.start_date as job_start_date,
        sr.end_date as job_end_date,
        sr.user_name as job_client_name,
        sr.clerk_id as job_client_clerk_id,
        sr.created_at as job_created_at
      FROM job_applications a
      JOIN service_request sr ON a.job_id = sr.id
      WHERE a.id = ${applicationId}
      LIMIT 1;
    `;

    if (result.length === 0) {
      return null;
    }

    return transformApplication(result[0], { viewerRole: options.viewerRole || "admin" });
  } catch (error) {
    logger.error(`Error fetching application ${applicationId}:`, error);
    throw error;
  }
}

export async function updateApplicationClientContact(
  applicationId,
  {
    phoneNumber,
    contactName = null,
    contactInstructions = null,
    sharedByClerkId = null,
  }
) {
  const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
  const trimmedContactName = trimOptionalString(contactName) || null;
  const trimmedContactInstructions = trimOptionalString(contactInstructions) || null;

  try {
    const result = await sql`
      UPDATE job_applications
      SET
        client_contact_phone = ${normalizedPhoneNumber},
        client_contact_name = ${trimmedContactName},
        contact_release_notes = ${trimmedContactInstructions},
        contact_shared_at = NOW(),
        contact_shared_by_clerk_id = ${sharedByClerkId || null},
        updated_at = NOW()
      WHERE id = ${applicationId}
      RETURNING *;
    `;

    if (result.length === 0) {
      throw new Error("Application not found");
    }

    logger.info(`Application ${applicationId} contact details updated`);
    return getApplicationById(applicationId, { viewerRole: "admin" });
  } catch (error) {
    if (isMissingApplicationContactColumnError(error)) {
      throw new Error(
        "Database migration required before sharing phone numbers. Run migrations/add_application_contact_fields.sql"
      );
    }

    logger.error(`Error updating contact details for application ${applicationId}:`, error);
    throw error;
  }
}

/**
 * Get all applications (for debugging)
 */
export async function getAllApplications() {
  try {
    const result = await sql`
      SELECT
        a.*,
        sr.service_type as job_service_type,
        sr.clerk_id as job_client_clerk_id,
        sr.user_name as job_client_name,
        sr.max_price as job_max_price,
        sr.created_at as job_created_at
      FROM job_applications a
      JOIN service_request sr ON a.job_id = sr.id
      ORDER BY a.created_at DESC;
    `;

    logger.info(`Retrieved ${result.length} total applications`);
    return result.map((app) => ({
      ...transformApplication(app, { viewerRole: "admin" }),
      jobServiceType: app.job_service_type,
      jobClerkId: app.job_client_clerk_id,
      jobOwnerName: app.job_client_name,
    }));
  } catch (error) {
    logger.error("Error fetching all applications:", error);
    throw error;
  }
}

/**
 * Get all applications for jobs owned by a client
 */
export async function getApplicationsForClient(clerkId) {
  try {
    const result = await sql`
      SELECT
        a.*,
        sr.id as job_id,
        sr.service_type as job_service_type,
        sr.max_price as job_max_price,
        sr.start_date as job_start_date,
        sr.end_date as job_end_date,
        sr.clerk_id as job_client_clerk_id,
        sr.user_name as job_client_name,
        sr.created_at as job_created_at
      FROM job_applications a
      JOIN service_request sr ON a.job_id = sr.id
      WHERE sr.clerk_id = ${clerkId}
      ORDER BY a.created_at DESC;
    `;

    logger.info(`Retrieved ${result.length} applications for client ${clerkId}`);

    const jobsMap = new Map();
    result.forEach((app) => {
      const jobId = app.job_id;

      if (!jobsMap.has(jobId)) {
        jobsMap.set(jobId, {
          id: jobId,
          serviceType: app.job_service_type,
          maxPrice: Number(app.job_max_price) || 0,
          startDate: app.job_start_date,
          endDate: app.job_end_date,
          applications: [],
          applicationSummary: {
            total: 0,
            pending: 0,
            accepted: 0,
            rejected: 0,
          },
        });
      }

      const jobEntry = jobsMap.get(jobId);
      jobEntry.applications.push({
        ...transformApplication(app, { viewerRole: "client" }),
        conversationId: conversationIdForJobClerkPair(
          app.job_id,
          app.freelancer_clerk_id,
          app.job_client_clerk_id
        ),
      });

      jobEntry.applicationSummary.total += 1;
      if (jobEntry.applicationSummary[app.status] !== undefined) {
        jobEntry.applicationSummary[app.status] += 1;
      }
    });

    return Array.from(jobsMap.values());
  } catch (error) {
    logger.error(`Error fetching applications for client ${clerkId}:`, error);
    throw error;
  }
}
