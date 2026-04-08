import {
  createApplication,
  getApplicationsByJobId,
  getApplicationCountByJobId,
  getApplicationsByFreelancerId,
  updateApplicationStatus,
  getAllApplications,
  getApplicationsForClient,
  getApplicationById,
  updateApplicationClientContact,
  clearApplicationClientContact,
} from "#services/application.service.js";
import { getJobById } from "#services/jobs.service.js";
import { createNotification } from "#services/notifications.service.js";
import { ensureJobConversation } from "#services/messaging.service.js";
import { emitToUser } from "#config/socket.js";
import logger from "#config/logger.js";

const APPLICATION_STATUS_ALIASES = {
  pending: "pending",
  accept: "accepted",
  accepted: "accepted",
  approve: "accepted",
  approved: "accepted",
  reject: "rejected",
  rejected: "rejected",
  decline: "rejected",
  declined: "rejected",
};

function trimOptionalString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function pickFirstProvidedString(...values) {
  for (const value of values) {
    const trimmedValue = trimOptionalString(value);
    if (trimmedValue) {
      return trimmedValue;
    }
  }

  return null;
}

export function normalizeApplicationStatus(status) {
  const normalizedStatus = trimOptionalString(status).toLowerCase();
  return APPLICATION_STATUS_ALIASES[normalizedStatus] || null;
}

export function resolveApplicationContactPayload(payload = {}) {
  return {
    phoneNumber: pickFirstProvidedString(
      payload.phoneNumber,
      payload.clientPhoneNumber,
      payload.contactPhoneNumber,
      payload.contactPhone,
      payload.contactNumber,
      payload.phone,
      payload.mobileNumber,
      payload.client_contact_phone
    ),
    contactName: pickFirstProvidedString(
      payload.contactName,
      payload.clientName,
      payload.contactPerson,
      payload.contactPersonName,
      payload.client_contact_name
    ),
    contactInstructions: pickFirstProvidedString(
      payload.contactInstructions,
      payload.instructions,
      payload.contactNotes,
      payload.contactReleaseNotes,
      payload.notes,
      payload.contact_release_notes
    ),
  };
}

function resolveApplicantIdentity(req) {
  const authClerkId = req.user?.clerkId || null;
  const authName = req.user?.userName || null;

  const bodyUserId = trimOptionalString(req.body?.userId);
  const bodyUserName = trimOptionalString(req.body?.userName);
  const bodyUserEmail = trimOptionalString(req.body?.userEmail);

  if (authClerkId && bodyUserId && bodyUserId !== authClerkId) {
    throw new Error("Authenticated user does not match application payload");
  }

  return {
    userId: authClerkId || bodyUserId,
    userName: authName || bodyUserName || "Freelancer",
    userEmail: bodyUserEmail || null,
  };
}

async function resolveApplicationJobContext(application) {
  const jobFromApplication = application?.job || null;

  if (
    jobFromApplication?.clientClerkId &&
    jobFromApplication?.serviceType
  ) {
    return {
      clerkId: jobFromApplication.clientClerkId,
      serviceType: jobFromApplication.serviceType,
      userName: jobFromApplication.clientName || "Client",
    };
  }

  return getJobById(application.jobId);
}

async function notifyApplicationUpdate({
  recipientClerkId,
  jobId,
  message,
  application = null,
}) {
  try {
    const notification = await createNotification({
      userId: recipientClerkId,
      jobId,
      message,
    });

    emitToUser(recipientClerkId, "notification:new", {
      notification: application
        ? {
            ...notification,
            application,
          }
        : notification,
    });
  } catch (notifError) {
    logger.error("Error sending application notification:", notifError);
  }
}

/**
 * Apply to a job
 * POST /api/jobs/:id/apply
 */
export async function applyToJob(req, res) {
  const { id: jobId } = req.params;

  try {
    const { quotation, conditions } = req.body || {};
    const { userId, userName, userEmail } = resolveApplicantIdentity(req);

    logger.info(`[Apply] New application attempt - JobID: ${jobId}, User: ${userId} (${userName})`);

    if (!userId) {
      logger.warn(`[Apply] Missing userId in application request for job ${jobId}`);
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const [job, existingApplicationsCount] = await Promise.all([
      getJobById(jobId),
      getApplicationCountByJobId(Number(jobId)),
    ]);

    if (!job) {
      logger.warn(`[Apply] Job ${jobId} not found`);
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    logger.info(`[Apply] Job found - ${job.serviceType}, Owner: ${job.clerkId}`);

    if (job.clerkId === userId) {
      return res.status(400).json({
        success: false,
        message: "You cannot apply to your own job",
      });
    }

    if (existingApplicationsCount >= 5) {
      logger.warn(`[Apply] Job ${jobId} already has 5 applications. Rejecting new application.`);
      return res.status(400).json({
        success: false,
        message: "This job already has the maximum number of applications (5). Better luck next time!",
        limitReached: true,
      });
    }

    logger.info("[Apply] Creating application record...");
    const application = await createApplication({
      jobId: Number(jobId),
      freelancerClerkId: userId,
      freelancerName: userName || "Freelancer",
      freelancerEmail: userEmail || null,
      quotation: quotation || null,
      conditions: conditions || null,
    });
    logger.info(`[Apply] Application created successfully - ID: ${application.id}`);

    let conversation = null;

    try {
      conversation = await ensureJobConversation({
        jobId: Number(jobId),
        jobTitle: job.serviceType,
        currentClerkId: userId,
        currentUserName: userName || "Freelancer",
        otherClerkId: job.clerkId,
        otherUserName: job.userName || "Client",
      });
    } catch (conversationError) {
      logger.error("[Apply] Error creating job conversation:", conversationError);
    }

    logger.info(`[Apply] Creating notification for client ${job.clerkId}...`);
    await notifyApplicationUpdate({
      recipientClerkId: job.clerkId,
      jobId: Number(jobId),
      message: `${userName || "A freelancer"} applied to your job: ${job.serviceType}`,
      application: {
        id: application.id,
        freelancerName: application.freelancerName,
        freelancerEmail: application.freelancerEmail,
        createdAt: application.createdAt,
        applicationSpotlight: application.applicationSpotlight,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Application submitted successfully",
      data: application,
      ...(conversation
        ? {
            conversation: {
              conversationId: conversation.conversationId,
              jobId: conversation.jobId,
              jobTitle: conversation.jobTitle,
              otherClerkId: job.clerkId,
              otherDisplayName: job.userName || "Client",
            },
          }
        : {}),
    });
  } catch (error) {
    logger.error("Error applying to job:", error);

    if (error.message.includes("already applied")) {
      logger.info(`[Apply] User ${req.user?.clerkId || req.body?.userId} attempted duplicate application to job ${jobId}`);
      return res.status(200).json({
        success: true,
        message: "You have already applied to this job",
        alreadyApplied: true,
      });
    }

    if (error.message.includes("does not match application payload")) {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to submit application",
      error: error.message,
    });
  }
}

/**
 * Get all applications for a job (for job owner/client)
 * GET /api/jobs/:id/applications
 */
export async function getJobApplications(req, res) {
  try {
    const { id: jobId } = req.params;
    const { user } = req;

    logger.info(`[GetApps] Fetching applications for job ${jobId}, User: ${user?.clerkId}`);

    const job = await getJobById(jobId);
    if (!job) {
      logger.warn(`[GetApps] Job ${jobId} not found`);
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    logger.info(`[GetApps] Job found - ${job.serviceType}, Owner: ${job.clerkId}`);

    if (user?.clerkId !== job.clerkId) {
      logger.warn(`[GetApps] Permission denied - User ${user?.clerkId} does not own job ${jobId}`);
      return res.status(403).json({
        success: false,
        message: "You do not have permission to view these applications",
      });
    }

    const applications = await getApplicationsByJobId(jobId);
    logger.info(`[GetApps] Found ${applications.length} applications for job ${jobId}`);

    return res.status(200).json({
      success: true,
      message: "Applications retrieved successfully",
      data: applications,
    });
  } catch (error) {
    logger.error(`[GetApps] Error fetching job applications for job ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve applications",
      error: error.message,
    });
  }
}

/**
 * Get all applications submitted by the current user (freelancer)
 * GET /api/applications/my
 */
export async function getMyApplications(req, res) {
  try {
    const { user } = req;

    if (!user?.clerkId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const applications = await getApplicationsByFreelancerId(user.clerkId);

    return res.status(200).json({
      success: true,
      message: "Your applications retrieved successfully",
      data: applications,
    });
  } catch (error) {
    logger.error("Error fetching user applications:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve your applications",
      error: error.message,
    });
  }
}

/**
 * Update application status (accept/reject)
 * PATCH /api/applications/:id/status
 */
export async function updateApplicationStatusController(req, res) {
  try {
    const { id: applicationId } = req.params;
    const { status } = req.body || {};
    const normalizedStatus = normalizeApplicationStatus(status);
    const {
      phoneNumber: resolvedPhoneNumber,
      contactName,
      contactInstructions,
    } = resolveApplicationContactPayload(req.body);
    const { user } = req;

    if (!normalizedStatus) {
      return res.status(400).json({
        success: false,
        message: "Status must be one of: pending, accept, accepted, reject, rejected",
      });
    }

    const application = await getApplicationById(applicationId, { viewerRole: "admin" });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    const job = await resolveApplicationJobContext(application);
    if (user?.clerkId !== job.clerkId) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to update this application",
      });
    }

    let updatedApplication = await updateApplicationStatus(applicationId, normalizedStatus);
    let contactSharedNow = false;

    if (normalizedStatus === "accepted" && resolvedPhoneNumber) {
      updatedApplication = await updateApplicationClientContact(applicationId, {
        phoneNumber: resolvedPhoneNumber,
        contactName,
        contactInstructions,
        sharedByClerkId: user?.clerkId || null,
      });
      contactSharedNow = true;
    } else if (
      normalizedStatus !== "accepted" &&
      application.contactExchange?.readyForDirectContact
    ) {
      updatedApplication = await clearApplicationClientContact(applicationId);
    }

    const statusMessage =
      normalizedStatus === "accepted"
        ? contactSharedNow
          ? `Your application for "${job.serviceType}" has been accepted and the client shared a phone number for direct contact.`
          : `Your application for "${job.serviceType}" has been accepted. The client can now share a phone number for direct contact.`
        : `Your application for "${job.serviceType}" has been rejected`;

    await notifyApplicationUpdate({
      recipientClerkId: application.freelancerClerkId,
      jobId: application.jobId,
      message: statusMessage,
      application: {
        id: updatedApplication.id,
        status: updatedApplication.status,
        contactExchange: updatedApplication.contactExchange,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Application status updated successfully",
      data: updatedApplication,
      ...(normalizedStatus === "accepted" && !updatedApplication.contactExchange.readyForDirectContact
        ? {
            nextStep: {
              action: "share_client_phone_number",
              applicationId: updatedApplication.id,
              endpoint: `/api/applications/${updatedApplication.id}/contact`,
            },
          }
        : {}),
    });
  } catch (error) {
    logger.error("Error updating application status:", error);
    return res.status(
      error.message.includes("Database migration required") || error.message.includes("Phone number")
        ? 400
        : 500
    ).json({
      success: false,
      message: "Failed to update application status",
      error: error.message,
    });
  }
}

/**
 * Share direct contact details after an application is accepted
 * PATCH /api/applications/:id/contact
 */
export async function shareApplicationContactController(req, res) {
  try {
    const { id: applicationId } = req.params;
    const {
      phoneNumber,
      contactName,
      contactInstructions,
    } = resolveApplicationContactPayload(req.body);
    const { user } = req;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    const application = await getApplicationById(applicationId, { viewerRole: "admin" });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    const job = await resolveApplicationJobContext(application);
    if (user?.clerkId !== job.clerkId) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to share contact details for this application",
      });
    }

    if (application.status !== "accepted") {
      return res.status(400).json({
        success: false,
        message: "Contact details can only be shared after the application is accepted",
      });
    }

    const updatedApplication = await updateApplicationClientContact(applicationId, {
      phoneNumber,
      contactName,
      contactInstructions,
      sharedByClerkId: user?.clerkId || null,
    });

    await notifyApplicationUpdate({
      recipientClerkId: application.freelancerClerkId,
      jobId: application.jobId,
      message: `${job.userName || "The client"} shared a phone number for "${job.serviceType}". You can now contact them directly.`,
      application: {
        id: updatedApplication.id,
        status: updatedApplication.status,
        contactExchange: updatedApplication.contactExchange,
      },
    });

    emitToUser(application.freelancerClerkId, "application:contact-shared", {
      applicationId: updatedApplication.id,
      contactExchange: updatedApplication.contactExchange,
    });

    return res.status(200).json({
      success: true,
      message: "Client contact details shared successfully",
      data: updatedApplication,
    });
  } catch (error) {
    logger.error("Error sharing application contact details:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to share contact details",
    });
  }
}

export async function acceptApplicationController(req, res) {
  req.body = {
    ...(req.body || {}),
    status: "accepted",
  };

  return updateApplicationStatusController(req, res);
}

export async function rejectApplicationController(req, res) {
  req.body = {
    ...(req.body || {}),
    status: "rejected",
  };

  return updateApplicationStatusController(req, res);
}

/**
 * Get all applications (debug endpoint)
 * GET /api/applications/all
 */
export async function getAllApplicationsController(req, res) {
  try {
    const applications = await getAllApplications();
    logger.info(`Retrieved ${applications.length} total applications for debugging`);

    return res.status(200).json({
      success: true,
      message: "All applications retrieved successfully",
      data: applications,
      count: applications.length,
    });
  } catch (error) {
    logger.error("Error fetching all applications:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve applications",
      error: error.message,
    });
  }
}

/**
 * Get applications for client's jobs (simplified endpoint)
 * GET /api/applications/client
 */
export async function getClientApplicationsController(req, res) {
  try {
    const { user } = req;

    if (!user?.clerkId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    logger.info(`[ClientApps] Fetching applications for client ${user.clerkId}`);
    const jobsWithApplications = await getApplicationsForClient(user.clerkId);
    logger.info(`[ClientApps] Found ${jobsWithApplications.length} jobs with applications`);

    return res.status(200).json({
      success: true,
      message: "Applications retrieved successfully",
      data: jobsWithApplications,
    });
  } catch (error) {
    logger.error("Error fetching client applications:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve applications",
      error: error.message,
    });
  }
}
