import { getAllJobs, createJob, searchJobs } from "#services/jobs.service.js";
import logger from "#config/logger.js";

export async function getJobs(req, res) {
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
    } = req.body;

    if (!serviceType || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: serviceType, startDate, endDate",
      });
    }

    const jobData = {
      serviceType: serviceType,
      selectedServices: JSON.stringify(selectedServices || []),
      startDate: startDate,
      endDate: endDate,
      maxPrice: Number(maxPrice) || 0,
      specialistChoice: specialistChoice || null,
      additionalInfo: additionalInfo || null,
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

export async function searchJobsController(req, res) {
  try {
    const filters = {
      serviceType: req.query.serviceType,
      selectedService: req.query.selectedService,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice) : undefined,
      specialistChoice: req.query.specialistChoice,
      additionalInfo: req.query.additionalInfo,
      limit: req.query.limit ? parseInt(req.query.limit) : 50,
      offset: req.query.offset ? parseInt(req.query.offset) : 0,
      sortBy: req.query.sortBy || 'start_date',
      sortOrder: req.query.sortOrder || 'DESC'
    };

    // Remove undefined filters
    Object.keys(filters).forEach(k => filters[k] === undefined && delete filters[k]);

    const result = await searchJobs(filters);

    logger.info(`Search completed: ${result.jobs.length} jobs found with filters: ${JSON.stringify(filters)}`);

    return res.status(200).json({
      success: true,
      message: "Job search completed successfully",
      data: result.jobs,
      pagination: result.pagination,
      filters: filters
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
