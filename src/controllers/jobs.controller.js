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

    // Trigger notifications to users matching skills
    try {
      const { findUsersMatchingJob } = await import('#services/match.service.js');
      const { createNotification } = await import('#services/notifications.service.js');
      const { emitToUser } = await import('#config/socket.js');

      const selectedServicesArr = Array.isArray(selectedServices) ? selectedServices : (selectedServices ? JSON.parse(selectedServices).filter(Boolean) : []);
      const matchedUsers = await findUsersMatchingJob({ serviceType, selectedServices: selectedServicesArr });

      const message = `New job posted: ${serviceType}`;
      for (const u of matchedUsers) {
        const notif = await createNotification({ userId: u.id, jobId: newJob.id, message });
        emitToUser(u.id, 'notification:new', { notification: notif });
      }
      logger.info(`Notifications sent for jobId=${newJob.id} to ${matchedUsers.length} users`);
    } catch (notifyErr) {
      logger.error('Error while triggering notifications for new job', notifyErr);
      // Do not fail the request if notifications fail
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
