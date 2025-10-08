import { neon } from "@neondatabase/serverless";
import logger from "#config/logger.js";

const sql = neon(process.env.DATABASE_URL);

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
    return result;
  } catch (error) {
    logger.error("Database error (fetch):", error);
    throw new Error("Database query failed while retrieving service requests.");
  }
}

export async function createJob(jobData) {
  const {
    service_type,
    selected_services,
    start_date,
    end_date,
    max_price,
    specialist_choice,
    additional_info,
    documents,
  } = jobData;

  try {
    const result = await sql`
      INSERT INTO service_request (
        service_type, selected_services, start_date, end_date, max_price,
        specialist_choice, additional_info, documents
      )
      VALUES (
        ${service_type},
        ${selected_services}, 
        ${start_date},
        ${end_date},
        ${max_price},
        ${specialist_choice},
        ${additional_info},
        ${documents}
      )
      RETURNING *;
    `;
    logger.info("New service request created successfully");
    return result[0];
  } catch (error) {
    logger.error("Database error (insert):", error);
    throw new Error("Failed to create new service request in the database.");
  }
}
