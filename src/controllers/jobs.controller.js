import { getAllJobs, createJob } from "#services/jobs.service.js";
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

export async function createJobController(req, res, next) {
  try {
    const jobData = req.body;

    // Basic validation
    if (!jobData.serviceType || !jobData.startDate || !jobData.endDate) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: serviceType, startDate, endDate",
      });
    }

    const newJob = await createJob(jobData);
    logger.info(`Created new service request: ${newJob.id}`);

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
