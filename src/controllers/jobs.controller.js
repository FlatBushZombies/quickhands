import { getAllJobs } from "#services/jobs.service.js";
import logger from "#config/logger.js";

export async function getJobs(req, res, next) {
  try {
    const jobs = await getAllJobs();
    logger.info("Successfully retrieved all job requests");
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