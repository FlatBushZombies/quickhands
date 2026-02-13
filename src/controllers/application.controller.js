import {
  createApplication,
  getApplicationsByJobId,
  getApplicationsByFreelancerId,
  updateApplicationStatus,
  getAllApplications,
  getApplicationsForClient,
} from "#services/application.service.js";
import { getJobById } from "#services/jobs.service.js";
import { createNotification } from "#services/notifications.service.js";
import { emitToUser } from "#config/socket.js";
import logger from "#config/logger.js";

/**
 * Apply to a job
 * POST /api/jobs/:id/apply
 */
export async function applyToJob(req, res) {
  try {
    const { id: jobId } = req.params;
    const { userId, userName, userEmail, quotation, conditions } = req.body;

    logger.info(`[Apply] New application attempt - JobID: ${jobId}, User: ${userId} (${userName})`);

    // Validate required fields
    if (!userId) {
      logger.warn(`[Apply] Missing userId in application request for job ${jobId}`);
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // Check if job exists
    const job = await getJobById(jobId);
    if (!job) {
      logger.warn(`[Apply] Job ${jobId} not found`);
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }
    
    logger.info(`[Apply] Job found - ${job.serviceType}, Owner: ${job.clerkId}`);

    // Prevent applying to own job
    if (job.clerkId === userId) {
      return res.status(400).json({
        success: false,
        message: "You cannot apply to your own job",
      });
    }

    // Check if job already has 5 applications
    const existingApplications = await getApplicationsByJobId(jobId);
    if (existingApplications.length >= 5) {
      logger.warn(`[Apply] Job ${jobId} already has 5 applications. Rejecting new application.`);
      return res.status(400).json({
        success: false,
        message: "This job already has the maximum number of applications (5). Better luck next time!",
        limitReached: true,
      });
    }

    // Create application
    logger.info(`[Apply] Creating application record...`);
    const application = await createApplication({
      jobId: Number(jobId),
      freelancerClerkId: userId,
      freelancerName: userName || "Freelancer",
      freelancerEmail: userEmail || null,
      quotation: quotation || null,
      conditions: conditions || null,
    });
    logger.info(`[Apply] Application created successfully - ID: ${application.id}`);

    // Create notification for the client (non-blocking)
    logger.info(`[Apply] Creating notification for client ${job.clerkId}...`);
    try {
      const message = `${userName || "A freelancer"} applied to your job: ${job.serviceType}`;
      const notification = await createNotification({
        userId: job.clerkId,
        jobId: Number(jobId),
        message,
      });

      logger.info(`[Apply] Notification created successfully - ID: ${notification.id}`);
      
      // Try to emit via Socket.IO (may fail if not connected, that's ok)
      try {
        emitToUser(job.clerkId, "notification:new", {
          notification: {
            ...notification,
            application: {
              id: application.id,
              freelancerName: application.freelancerName,
              freelancerEmail: application.freelancerEmail,
              createdAt: application.createdAt,
            },
          },
        });
        logger.info(`[Apply] Socket emission attempted for client ${job.clerkId}`);
      } catch (socketError) {
        logger.warn(`[Apply] Socket emission failed (OK - client will poll):`, socketError.message);
      }
    } catch (notifError) {
      logger.error("[Apply] Error creating notification:", notifError);
      // Don't fail the request if notification fails
    }

    return res.status(201).json({
      success: true,
      message: "Application submitted successfully",
      data: application,
    });
  } catch (error) {
    logger.error("Error applying to job:", error);
    
    // Handle duplicate application error - return success to avoid user confusion
    if (error.message.includes("already applied")) {
      logger.info(`[Apply] User ${userId} attempted duplicate application to job ${jobId}`);
      return res.status(200).json({
        success: true,
        message: "You have already applied to this job",
        alreadyApplied: true,
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

    // Check if job exists
    const job = await getJobById(jobId);
    if (!job) {
      logger.warn(`[GetApps] Job ${jobId} not found`);
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    logger.info(`[GetApps] Job found - ${job.serviceType}, Owner: ${job.clerkId}`);

    // Verify user owns this job
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
    const { status } = req.body;
    const { user } = req;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }

    // Get application details
    const { getApplicationById } = await import("#services/application.service.js");
    const application = await getApplicationById(applicationId);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    // Get job to verify ownership
    const job = await getJobById(application.jobId);
    if (user?.clerkId !== job.clerkId) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to update this application",
      });
    }

    const updatedApplication = await updateApplicationStatus(applicationId, status);

    // Notify freelancer about status change
    try {
      const statusMessage = status === 'accepted' 
        ? `Your application for "${job.serviceType}" has been accepted!`
        : `Your application for "${job.serviceType}" has been rejected`;
      
      const notification = await createNotification({
        userId: application.freelancerClerkId,
        jobId: application.jobId,
        message: statusMessage,
      });

      emitToUser(application.freelancerClerkId, "notification:new", {
        notification,
      });
    } catch (notifError) {
      logger.error("Error sending status notification:", notifError);
    }

    return res.status(200).json({
      success: true,
      message: "Application status updated successfully",
      data: updatedApplication,
    });
  } catch (error) {
    logger.error("Error updating application status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update application status",
      error: error.message,
    });
  }
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
