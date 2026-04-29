import logger from "#config/logger.js";
import { findUsersMatchingJob } from "#services/match.service.js";
import { getAllJobs, createJob, searchJobs, getJobById } from "#services/jobs.service.js";
import { notifyUser } from "#services/notifications.service.js";
import { getReviewSummariesByClerkIds } from "#services/user.service.js";
import { annotateLocationMatch, buildInYourAreaPhrase, normalizeLocationPayload } from "#utils/location.js";

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

function normalizeViewerLocation(source) {
  return normalizeLocationPayload(source || {});
}

function parseNumberQuery(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseSelectedServices(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).map(String);
  }

  if (typeof value !== "string" || value.trim() === "") {
    return [];
  }

  if (value.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function enhanceJobsForViewer(jobs, viewerLocation, nearbyOnly = false) {
  const normalizedViewerLocation = normalizeViewerLocation(viewerLocation);
  const canMeasureNearby =
    normalizedViewerLocation.latitude !== null ||
    normalizedViewerLocation.longitude !== null ||
    normalizedViewerLocation.city;

  const enhancedJobs = jobs.map((job) => {
    if (!job.location || !canMeasureNearby) {
      return {
        ...job,
        proximity: job.proximity || null,
      };
    }

    return {
      ...job,
      proximity: annotateLocationMatch({
        viewerLocation: normalizedViewerLocation,
        targetLocation: job.location,
        radiusKm: normalizedViewerLocation.radiusKm,
      }),
    };
  });

  const filteredJobs = nearbyOnly
    ? enhancedJobs.filter((job) => job.proximity?.inYourArea)
    : enhancedJobs;

  return filteredJobs.sort((left, right) => {
    const leftAreaRank = left.proximity?.inYourArea ? 0 : 1;
    const rightAreaRank = right.proximity?.inYourArea ? 0 : 1;
    if (leftAreaRank !== rightAreaRank) {
      return leftAreaRank - rightAreaRank;
    }

    const leftDistance = left.proximity?.distanceKm ?? Number.MAX_SAFE_INTEGER;
    const rightDistance = right.proximity?.distanceKm ?? Number.MAX_SAFE_INTEGER;
    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

async function enrichJobsWithClientProfiles(jobs) {
  const clientClerkIds = jobs.map((job) => job.clerkId).filter(Boolean);
  const reviewSummaries = await getReviewSummariesByClerkIds(clientClerkIds);

  return jobs.map((job) => ({
    ...job,
    clientReviewSummary:
      reviewSummaries.get(job.clerkId) || {
        averageRating: 0,
        reviewCount: 0,
        latestReview: null,
      },
  }));
}

function applyAdvancedJobFilters(jobs, query = {}) {
  const selectedServices = parseSelectedServices(
    query.selectedServices || query.selectedService
  );
  const minBudget = parseNumberQuery(query.minBudget);
  const maxBudget = parseNumberQuery(query.maxBudget ?? query.maxPrice);
  const minimumClientRating = parseNumberQuery(query.minimumClientRating);
  const specialistChoice = typeof query.specialistChoice === "string" ? query.specialistChoice.trim() : "";
  const sortBy = typeof query.sortBy === "string" ? query.sortBy : "relevance";

  let filteredJobs = [...jobs];

  if (selectedServices.length > 0) {
    filteredJobs = filteredJobs.filter((job) =>
      selectedServices.some((selectedService) =>
        (job.selectedServices || [])
          .map((service) => String(service).toLowerCase())
          .includes(String(selectedService).toLowerCase())
      )
    );
  }

  if (minBudget !== null) {
    filteredJobs = filteredJobs.filter((job) => Number(job.maxPrice) >= minBudget);
  }

  if (maxBudget !== null) {
    filteredJobs = filteredJobs.filter((job) => Number(job.maxPrice) <= maxBudget);
  }

  if (specialistChoice) {
    filteredJobs = filteredJobs.filter(
      (job) =>
        String(job.specialistChoice || "").toLowerCase() === specialistChoice.toLowerCase()
    );
  }

  if (minimumClientRating !== null) {
    filteredJobs = filteredJobs.filter(
      (job) => Number(job.clientReviewSummary?.averageRating || 0) >= minimumClientRating
    );
  }

  switch (sortBy) {
    case "budget_low":
      filteredJobs.sort((left, right) => Number(left.maxPrice) - Number(right.maxPrice));
      break;
    case "budget_high":
      filteredJobs.sort((left, right) => Number(right.maxPrice) - Number(left.maxPrice));
      break;
    case "client_rating":
      filteredJobs.sort(
        (left, right) =>
          Number(right.clientReviewSummary?.averageRating || 0) -
          Number(left.clientReviewSummary?.averageRating || 0)
      );
      break;
    case "newest":
      filteredJobs.sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      );
      break;
    case "distance":
      filteredJobs.sort(
        (left, right) =>
          Number(left.proximity?.distanceKm ?? Number.MAX_SAFE_INTEGER) -
          Number(right.proximity?.distanceKm ?? Number.MAX_SAFE_INTEGER)
      );
      break;
    default:
      break;
  }

  return filteredJobs;
}

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

    const [enhancedJob] = applyAdvancedJobFilters(
      await enrichJobsWithClientProfiles(enhanceJobsForViewer([job], req.query)),
      req.query
    );

    logger.info(`Successfully retrieved job request with ID: ${id}`);
    return res.status(200).json({
      success: true,
      message: "Service request fetched successfully",
      data: enhancedJob,
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

export async function getJobs(req, res) {
  try {
    const { clerkId, nearbyOnly } = req.query;
    const jobs = await getAllJobs(clerkId);
    const enhancedJobs = applyAdvancedJobFilters(
      await enrichJobsWithClientProfiles(
        enhanceJobsForViewer(jobs, req.query, nearbyOnly === "true")
      ),
      req.query
    );

    logger.info(`Successfully retrieved ${clerkId ? "user" : "all"} job requests`);
    return res.status(200).json({
      success: true,
      message: "Service requests fetched successfully",
      data: enhancedJobs,
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
      location: rawLocation,
    } = req.body;

    const { user } = req;
    const clerkId = bodyClerkId || user?.clerkId;
    const userName = bodyUserName || user?.userName || "Anonymous";
    const userAvatar = bodyUserAvatar !== undefined ? bodyUserAvatar : (user?.userAvatar || null);

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
    const normalizedLocation = normalizeLocationPayload(rawLocation || req.body);

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
      location: normalizedLocation,
    };

    const newJob = await createJob(jobData);
    logger.info(`Created new service request: ${newJob.id} by user: ${clerkId} (${userName})`);

    let nearbyFreelancerCount = 0;

    try {
      const matchedUsers = await findUsersMatchingJob({
        serviceType,
        selectedServices: normalizedSelectedServices,
        jobLocation: newJob.location || normalizedLocation,
        radiusKm: normalizedLocation.radiusKm,
      });
      nearbyFreelancerCount = matchedUsers.length;

      await Promise.all(
        matchedUsers.map((matchedUser) =>
          notifyUser({
            clerkId: matchedUser.clerkId,
            jobId: newJob.id,
            message: `New "${newJob.serviceType}" job${buildInYourAreaPhrase(matchedUser.locationMatch)}.`,
          }).catch((notificationError) => {
            logger.error("Error notifying matched freelancer", notificationError);
          })
        )
      );
    } catch (notifyErr) {
      logger.error("Error calculating nearby freelancer matches for new job", notifyErr);
    }

    return res.status(201).json({
      success: true,
      message: "Service request created successfully",
      data: newJob,
      matchingSummary: {
        nearbyFreelancerCount,
        inYourArea: nearbyFreelancerCount > 0,
      },
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
    const enhancedJobs = applyAdvancedJobFilters(
      await enrichJobsWithClientProfiles(
        enhanceJobsForViewer(result.jobs, req.query, req.query.nearbyOnly === "true")
      ),
      req.query
    );

    logger.info(
      `Search completed: ${enhancedJobs.length} jobs found with filters: ${JSON.stringify(filters)}`
    );

    return res.status(200).json({
      success: true,
      message: "Job search completed successfully",
      data: enhancedJobs,
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
