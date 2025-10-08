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
    const {
      serviceType,
      selectedServices,
      startDate,
      endDate,
      maxPrice,
      specialistChoice,
      additionalInfo,
      documents,
    } = req.body;

    // Basic validation
    if (!serviceType || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: serviceType, startDate, endDate",
      });
    }

    // Map to snake_case for database and handle arrays as JSON
    const jobData = {
      service_type: serviceType,
      selected_services: JSON.stringify(selectedServices || []),
      start_date: startDate,
      end_date: endDate,
      max_price: Number(maxPrice) || 0,
      specialist_choice: specialistChoice || null,
      additional_info: additionalInfo || null,
      documents: JSON.stringify(documents || []),
    };

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
