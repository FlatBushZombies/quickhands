import logger from "#config/logger.js";
import { emitToUser } from "#config/socket.js";
import { createNotification } from "#services/notifications.service.js";
import { findUsersMatchingJob } from "#services/match.service.js";
import {
  getAllJobs,
  createJob,
  searchJobs,
  getJobById,
} from "#services/jobs.service.js";

function parseStringArray(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (typeof value !== "string" || value.trim() === "") {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

/**
 * Get a single job by ID
 */
export async function getJob(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Job ID is required",
      });
    }

    const job = await getJobById(id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Service request not found",
      });
    }

    logger.info(`Successfully retrieved job request with ID: ${id}`);
    return res.status(200).json({
      success: true,
      message: "Service request fetched successfully",
      data: job,
    });
  } catch (error) {
    logger.error("Error fetching job by ID:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve service request",
      error: error.message,
    });
  }
}

/**
 * Get all jobs
 */
export async function getJobs(req, res) {
  try {
    const { clerkId } = req.query;
    const jobs = await getAllJobs(clerkId);
    logger.info(`Successfully retrieved ${clerkId ? "user" : "all"} job requests`);
    return res.status(200).json({
      success: true,
      message: "Service requests fetched successfully",
      data: jobs,
    });
  } catch (error) {
    logger.error("Error fetching jobs:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve service requests",
      error: error.message,
    });
  }
}

/**
 * Create a new job request
 * Uses req.user populated from Clerk JWT middleware.
 */
export async function createJobController(req, res) {
  try {
    const {
      serviceType,
      selectedServices,
      startDate,
      endDate,
      maxPrice,
      specialistChoice,
      additionalInfo,
      documents,
      clerkId: bodyClerkId,
      userName: bodyUserName,
      userAvatar: bodyUserAvatar,
    } = req.body;

    const { user } = req;
    const clerkId = bodyClerkId || user?.clerkId;
    const userName = bodyUserName || user?.userName || "Anonymous";
    const userAvatar =
      bodyUserAvatar !== undefined ? bodyUserAvatar : (user?.userAvatar || null);

    if (!serviceType || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: serviceType, startDate, endDate",
      });
    }

    if (!clerkId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    const normalizedSelectedServices = parseStringArray(selectedServices);
    const normalizedDocuments = parseStringArray(documents);

    const jobData = {
      serviceType,
      selectedServices: JSON.stringify(normalizedSelectedServices),
      startDate,
      endDate,
      maxPrice: Number(maxPrice) || 0,
      specialistChoice: specialistChoice || null,
      additionalInfo: additionalInfo || null,
      documents: JSON.stringify(normalizedDocuments),
      clerkId,
      userName,
      userAvatar,
    };

    const newJob = await createJob(jobData);
    logger.info(`Created new service request: ${newJob.id} by user: ${clerkId} (${userName})`);

    try {
      const matchedUsers = await findUsersMatchingJob({
        serviceType,
        selectedServices: normalizedSelectedServices,
      });

      const message = `New job posted: ${serviceType}`;
      const notificationResults = await Promise.allSettled(
        matchedUsers.map(async (matchedUser) => {
          const notification = await createNotification({
            userId: matchedUser.id,
            jobId: newJob.id,
            message,
          });

          emitToUser(matchedUser.clerkId, "notification:new", {
            notification,
          });

          return notification;
        })
      );

      const deliveredCount = notificationResults.filter(
        (result) => result.status === "fulfilled"
      ).length;

      const failedCount = notificationResults.length - deliveredCount;

      logger.info(
        `Notifications sent for jobId=${newJob.id} to ${deliveredCount}/${matchedUsers.length} matched users`
      );

      if (failedCount > 0) {
        logger.warn(
          `Notification fan-out completed with ${failedCount} failures for jobId=${newJob.id}`
        );
      }
    } catch (notifyErr) {
      logger.error("Error triggering notifications for new job", notifyErr);
      // Do not fail request if notifications fail
    }

    return res.status(201).json({
      success: true,
      message: "Service request created successfully",
      data: newJob,
    });
  } catch (error) {
    logger.error("Error creating job:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to create service request",
      error: error.message,
    });
  }
}

/**
 * Search jobs with filters
 */
export async function searchJobsController(req, res) {
  try {
    const queryParam = req.query.q;

    const filters = {
      serviceType: req.query.serviceType || queryParam,
      selectedService: req.query.selectedService,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice) : undefined,
      specialistChoice: req.query.specialistChoice,
      additionalInfo: req.query.additionalInfo,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : 50,
      offset: req.query.offset ? parseInt(req.query.offset, 10) : 0,
      sortBy: req.query.sortBy || "start_date",
      sortOrder: req.query.sortOrder || "DESC",
    };

    Object.keys(filters).forEach((key) => filters[key] === undefined && delete filters[key]);

    const result = await searchJobs(filters);

    logger.info(
      `Search completed: ${result.jobs.length} jobs found with filters: ${JSON.stringify(filters)}`
    );

    return res.status(200).json({
      success: true,
      message: "Job search completed successfully",
      data: result.jobs,
      pagination: result.pagination,
      filters,
    });
  } catch (error) {
    logger.error("Error searching jobs:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to search service requests",
      error: error.message,
    });
  }
}
