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
    documents: job.documents
  };
}

export async function getJobById(jobId) {
  try {
    const result = await sql`
      SELECT
        id,
        service_type,
        selected_services,
        start_date,
        end_date,
        max_price,
        specialist_choice,
        additional_info,
        documents
      FROM service_request
      WHERE id = ${jobId};
    `;
    
    if (result.length === 0) {
      return null;
    }
    
    logger.info(`Fetched service request with ID: ${jobId}`);
    return transformJob(result[0]);
  } catch (error) {
    logger.error("Database error (fetch by ID):", error);
    throw new Error("Database query failed while retrieving service request by ID.");
  }
}

export async function getAllJobs() {
  try {
    const result = await sql`
      SELECT
        id,
        service_type,
        selected_services,
        start_date,
        end_date,
        max_price,
        specialist_choice,
        additional_info,
        documents
      FROM service_request;
    `;
    logger.info(`Fetched ${result.length} service requests successfully`);
    return result.map(transformJob);
  } catch (error) {
    logger.error("Database error (fetch):", error);
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
    documents
  } = jobData;

  try {
    const result = await sql`
      INSERT INTO service_request (
        service_type, selected_services, start_date, end_date, max_price,
        specialist_choice, additional_info, documents
      )
      VALUES (
        ${serviceType},
        ${selectedServices},
        ${startDate},
        ${endDate},
        ${maxPrice},
        ${specialistChoice},
        ${additionalInfo},
        ${documents}
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
        SELECT id, service_type, selected_services, start_date, end_date, max_price, specialist_choice, additional_info, documents
        FROM service_request
        WHERE service_type ILIKE ${'%' + serviceType + '%'}
        ORDER BY start_date DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countResult = await sql`SELECT COUNT(*) as total FROM service_request WHERE service_type ILIKE ${'%' + serviceType + '%'}`;
    }
    else if (maxPrice) {
      // Search by max price
      result = await sql`
        SELECT id, service_type, selected_services, start_date, end_date, max_price, specialist_choice, additional_info, documents
        FROM service_request
        WHERE max_price <= ${maxPrice}
        ORDER BY start_date DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countResult = await sql`SELECT COUNT(*) as total FROM service_request WHERE max_price <= ${maxPrice}`;
    }
    else if (selectedService) {
      // Search by selected service
      result = await sql`
        SELECT id, service_type, selected_services, start_date, end_date, max_price, specialist_choice, additional_info, documents
        FROM service_request
        WHERE selected_services::jsonb ? ${selectedService}
        ORDER BY start_date DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countResult = await sql`SELECT COUNT(*) as total FROM service_request WHERE selected_services::jsonb ? ${selectedService}`;
    }
    else {
      // No specific filters - return all with pagination
      result = await sql`
        SELECT id, service_type, selected_services, start_date, end_date, max_price, specialist_choice, additional_info, documents
        FROM service_request
        ORDER BY start_date DESC
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
