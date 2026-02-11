import { neon } from "@neondatabase/serverless";
import logger from "#config/logger.js";

const sql = neon(process.env.DATABASE_URL);

/**
 * Transform database row to camelCase response
 */
function transformApplication(app) {
  return {
    id: app.id,
    jobId: app.job_id,
    freelancerClerkId: app.freelancer_clerk_id,
    freelancerName: app.freelancer_name,
    freelancerEmail: app.freelancer_email,
    status: app.status,
    createdAt: app.created_at,
    updatedAt: app.updated_at,
  };
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
  } = applicationData;

  try {
    // Check if application already exists
    const existing = await sql`
      SELECT id FROM job_applications
      WHERE job_id = ${jobId} 
      AND freelancer_clerk_id = ${freelancerClerkId}
      LIMIT 1;
    `;

    if (existing.length > 0) {
      throw new Error("You have already applied to this job");
    }

    const result = await sql`
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

    logger.info(`Application created: id=${result[0].id}, jobId=${jobId}, freelancer=${freelancerClerkId}`);
    return transformApplication(result[0]);
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
      SELECT * FROM job_applications
      WHERE job_id = ${jobId}
      ORDER BY created_at DESC;
    `;

    logger.info(`Retrieved ${result.length} applications for job ${jobId}`);
    return result.map(transformApplication);
  } catch (error) {
    logger.error(`Error fetching applications for job ${jobId}:`, error);
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
        sr.service_type,
        sr.max_price,
        sr.start_date,
        sr.end_date,
        sr.user_name as client_name
      FROM job_applications a
      JOIN service_request sr ON a.job_id = sr.id
      WHERE a.freelancer_clerk_id = ${clerkId}
      ORDER BY a.created_at DESC;
    `;

    logger.info(`Retrieved ${result.length} applications for freelancer ${clerkId}`);
    return result.map(app => ({
      ...transformApplication(app),
      job: {
        serviceType: app.service_type,
        maxPrice: app.max_price,
        startDate: app.start_date,
        endDate: app.end_date,
        clientName: app.client_name,
      }
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
  const validStatuses = ['pending', 'accepted', 'rejected'];
  
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
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
    return transformApplication(result[0]);
  } catch (error) {
    logger.error(`Error updating application ${applicationId}:`, error);
    throw error;
  }
}

/**
 * Get application by ID
 */
export async function getApplicationById(applicationId) {
  try {
    const result = await sql`
      SELECT * FROM job_applications
      WHERE id = ${applicationId}
      LIMIT 1;
    `;

    if (result.length === 0) {
      return null;
    }

    return transformApplication(result[0]);
  } catch (error) {
    logger.error(`Error fetching application ${applicationId}:`, error);
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
        sr.service_type,
        sr.clerk_id as job_clerk_id,
        sr.user_name as job_owner_name
      FROM job_applications a
      JOIN service_request sr ON a.job_id = sr.id
      ORDER BY a.created_at DESC;
    `;

    logger.info(`Retrieved ${result.length} total applications`);
    return result.map(app => ({
      ...transformApplication(app),
      jobServiceType: app.service_type,
      jobClerkId: app.job_clerk_id,
      jobOwnerName: app.job_owner_name,
    }));
  } catch (error) {
    logger.error('Error fetching all applications:', error);
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
        sr.service_type,
        sr.max_price,
        sr.start_date,
        sr.end_date
      FROM job_applications a
      JOIN service_request sr ON a.job_id = sr.id
      WHERE sr.clerk_id = ${clerkId}
      ORDER BY a.created_at DESC;
    `;

    logger.info(`Retrieved ${result.length} applications for client ${clerkId}`);
    
    // Group by job
    const jobsMap = new Map();
    result.forEach(app => {
      const jobId = app.job_id;
      if (!jobsMap.has(jobId)) {
        jobsMap.set(jobId, {
          id: jobId,
          serviceType: app.service_type,
          maxPrice: Number(app.max_price) || 0,
          startDate: app.start_date,
          endDate: app.end_date,
          applications: []
        });
      }
      
      jobsMap.get(jobId).applications.push(transformApplication(app));
    });

    return Array.from(jobsMap.values());
  } catch (error) {
    logger.error(`Error fetching applications for client ${clerkId}:`, error);
    throw error;
  }
}
