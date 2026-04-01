import logger from "#config/logger.js";
import { sql } from "#config/database.js";

function parseJsonArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string" || value.trim() === "") {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

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
    clerkId: job.clerk_id,
    userName: job.user_name,
    userAvatar: job.user_avatar,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
  };
}

export async function getJobById(jobId) {
  const id = Number(jobId);
  if (Number.isNaN(id)) throw new Error(`Invalid job ID: ${jobId}`);

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
        documents,
        clerk_id,
        user_name,
        user_avatar,
        created_at,
        updated_at
      FROM service_request
      WHERE id = ${id}
      LIMIT 1;
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
    const result = clerkId
      ? await sql`
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
            created_at,
            updated_at
          FROM service_request
          WHERE clerk_id = ${clerkId}
          ORDER BY created_at DESC;
        `
      : await sql`
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
            created_at,
            updated_at
          FROM service_request
          ORDER BY created_at DESC;
        `;

    logger.info(`Fetched ${result.length} service requests successfully`);
    return result.map((job) => ({
      id: job.id,
      serviceType: job.service_type,
      selectedServices: parseJsonArray(job.selected_services),
      startDate: job.start_date,
      endDate: job.end_date,
      maxPrice: Number(job.max_price) || 0,
      specialistChoice: job.specialist_choice,
      additionalInfo: job.additional_info,
      documents: parseJsonArray(job.documents),
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
    clerkId,
    userName,
    userAvatar,
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
      RETURNING
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
        created_at,
        updated_at;
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
      maxPrice,
      limit = 50,
      offset = 0,
    } = filters;

    logger.info(`Executing search with filters: ${JSON.stringify(filters)}`);

    let jobsQuery;
    let countQuery;

    if (serviceType) {
      const pattern = `%${serviceType}%`;
      jobsQuery = sql`
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
          created_at,
          updated_at
        FROM service_request
        WHERE service_type ILIKE ${pattern}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countQuery = sql`
        SELECT COUNT(*) AS total
        FROM service_request
        WHERE service_type ILIKE ${pattern}
      `;
    } else if (maxPrice !== undefined) {
      jobsQuery = sql`
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
          created_at,
          updated_at
        FROM service_request
        WHERE max_price <= ${maxPrice}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countQuery = sql`
        SELECT COUNT(*) AS total
        FROM service_request
        WHERE max_price <= ${maxPrice}
      `;
    } else if (selectedService) {
      jobsQuery = sql`
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
          created_at,
          updated_at
        FROM service_request
        WHERE selected_services::jsonb ? ${selectedService}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countQuery = sql`
        SELECT COUNT(*) AS total
        FROM service_request
        WHERE selected_services::jsonb ? ${selectedService}
      `;
    } else {
      jobsQuery = sql`
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
          created_at,
          updated_at
        FROM service_request
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countQuery = sql`
        SELECT COUNT(*) AS total
        FROM service_request
      `;
    }

    const [result, countResult] = await Promise.all([jobsQuery, countQuery]);
    const total = Number.parseInt(countResult[0]?.total, 10) || 0;

    logger.info(`Search returned ${result.length} results out of ${total} total matches`);

    return {
      jobs: result.map(transformJob),
      pagination: {
        total,
        limit: Number.parseInt(limit, 10),
        offset: Number.parseInt(offset, 10),
        hasMore: Number.parseInt(offset, 10) + Number.parseInt(limit, 10) < total,
      },
    };
  } catch (error) {
    logger.error("Database error (search):", error);
    throw new Error("Database query failed while searching service requests.");
  }
}
