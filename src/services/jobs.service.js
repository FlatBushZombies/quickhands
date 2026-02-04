import { neon } from "@neondatabase/serverless";
import logger from "#config/logger.js";

const sql = neon(process.env.DATABASE_URL);

// Helper to convert snake_case -> camelCase
function transformJob(job) {
  return {
    id: job.id,
    serviceType: job.service_type,
    selectedServices: job.selected_services,
    startDate: job.start_date,
    endDate: job.end_date,
    maxPrice: job.max_price,
    specialistChoice: job.specialist_choice,
    additionalInfo: job.additional_info,
    documents: job.documents,
    // User information
    clerkId: job.clerk_id,
    userName: job.user_name,
    userAvatar: job.user_avatar,
    createdAt: job.created_at,
    updatedAt: job.updated_at
  };
}

export async function getJobById(jobId) {
  const id = Number(jobId);
  if (isNaN(id)) throw new Error(`Invalid job ID: ${jobId}`);

  try {
    const result = await sql`
      SELECT *
      FROM service_request
      WHERE id = ${id};
    `;

    if (!result || result.length === 0) {
      return null;
    }

    return transformJob(result[0]);
  } catch (error) {
    logger.error(`Database error fetching job ID ${id}:`, error);
    throw error;
  }
}

export async function getAllJobs(clerkId = null) {
  try {
    let result;
    
    if (clerkId) {
      // Filter by specific user's jobs
      result = await sql`
        SELECT
          id,
          service_type,
          selected_services,
          start_date,
          end_date,
          max_price,
          specialist_choice,
          additional_info,
          documents,
          clerk_id,
          user_name,
          user_avatar,
          created_at
        FROM service_request
        WHERE clerk_id = ${clerkId}
        ORDER BY created_at DESC;
      `;
    } else {
      // Get all jobs
      result = await sql`
        SELECT
          id,
          service_type,
          selected_services,
          start_date,
          end_date,
          max_price,
          specialist_choice,
          additional_info,
          documents,
          clerk_id,
          user_name,
          user_avatar,
          created_at
        FROM service_request
        ORDER BY created_at DESC;
      `;
    }

    logger.info(`Fetched ${result.length} service requests successfully`);
    logger.debug("getAllJobs raw result:", result);

    return result.map(job => ({
      id: job.id,
      serviceType: job.service_type,
      selectedServices: Array.isArray(job.selected_services)
        ? job.selected_services
        : JSON.parse(job.selected_services || '[]'),
      startDate: job.start_date,
      endDate: job.end_date,
      maxPrice: Number(job.max_price) || 0,
      specialistChoice: job.specialist_choice,
      additionalInfo: job.additional_info,
      documents: Array.isArray(job.documents)
        ? job.documents
        : JSON.parse(job.documents || '[]'),
      clerkId: job.clerk_id,
      userName: job.user_name || "Anonymous",
      userAvatar: job.user_avatar || null,
      createdAt: job.created_at,
    }));
  } catch (error) {
    logger.error("Database error (fetch all jobs):", error);
    throw new Error("Database query failed while retrieving service requests.");
  }
}


export async function createJob(jobData) {
  const {
    serviceType,
    selectedServices,
    startDate,
    endDate,
    maxPrice,
    specialistChoice,
    additionalInfo,
    documents,
    // User information
    clerkId,
    userName,
    userAvatar
  } = jobData;

  try {
    const result = await sql`
      INSERT INTO service_request (
        service_type, selected_services, start_date, end_date, max_price,
        specialist_choice, additional_info, documents, clerk_id, user_name, user_avatar
      )
      VALUES (
        ${serviceType},
        ${selectedServices},
        ${startDate},
        ${endDate},
        ${maxPrice},
        ${specialistChoice},
        ${additionalInfo},
        ${documents},
        ${clerkId},
        ${userName},
        ${userAvatar}
      )
      RETURNING *;
    `;
    logger.info("New service request created successfully");
    return transformJob(result[0]);
  } catch (error) {
    logger.error("Database error (insert):", error);
    throw new Error("Failed to create new service request in the database.");
  }
}

export async function searchJobs(filters) {
  try {
    const {
      serviceType,
      selectedService,
      startDate,
      endDate,
      maxPrice,
      specialistChoice,
      additionalInfo,
      limit = 50,
      offset = 0,
      sortBy = 'start_date',
      sortOrder = 'DESC'
    } = filters;

    logger.info(`Executing search with filters: ${JSON.stringify(filters)}`);

    // For now, let's implement a simple search that works
    // We'll just return all jobs with pagination and basic filtering
    
    let result;
    let countResult;
    
    if (serviceType) {
      // Search by service type
      result = await sql`
        SELECT id, service_type, selected_services, start_date, end_date, max_price, specialist_choice, additional_info, documents, clerk_id, user_name, user_avatar, created_at, updated_at
        FROM service_request
        WHERE service_type ILIKE ${'%' + serviceType + '%'}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countResult = await sql`SELECT COUNT(*) as total FROM service_request WHERE service_type ILIKE ${'%' + serviceType + '%'}`;
    }
    else if (maxPrice) {
      // Search by max price
      result = await sql`
        SELECT id, service_type, selected_services, start_date, end_date, max_price, specialist_choice, additional_info, documents, clerk_id, user_name, user_avatar, created_at, updated_at
        FROM service_request
        WHERE max_price <= ${maxPrice}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countResult = await sql`SELECT COUNT(*) as total FROM service_request WHERE max_price <= ${maxPrice}`;
    }
    else if (selectedService) {
      // Search by selected service
      result = await sql`
        SELECT id, service_type, selected_services, start_date, end_date, max_price, specialist_choice, additional_info, documents, clerk_id, user_name, user_avatar, created_at, updated_at
        FROM service_request
        WHERE selected_services::jsonb ? ${selectedService}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countResult = await sql`SELECT COUNT(*) as total FROM service_request WHERE selected_services::jsonb ? ${selectedService}`;
    }
    else {
      // No specific filters - return all with pagination
      result = await sql`
        SELECT id, service_type, selected_services, start_date, end_date, max_price, specialist_choice, additional_info, documents, clerk_id, user_name, user_avatar, created_at, updated_at
        FROM service_request
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countResult = await sql`SELECT COUNT(*) as total FROM service_request`;
    }
    
    const total = parseInt(countResult[0].total);

    logger.info(`Search returned ${result.length} results out of ${total} total matches`);

    return {
      jobs: result.map(transformJob),
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < total
      }
    };

  } catch (error) {
    logger.error("Database error (search):", error);
    throw new Error("Database query failed while searching service requests.");
  }
}
