import { neon } from "@neondatabase/serverless";
import logger from "#config/logger.js";

const sql = neon(process.env.DATABASE_URL);

export async function getAllJobs() {
  try {
    const result = await sql`
      SELECT
        service_type,
        selected_services,
        start_date,
        end_date,
        max_price,
        specialist_choice,
        additional_info,
        documents,
        created_at
      FROM service_request;
    `;
    logger.info(`Fetched ${result.length} service requests successfully`);
    return result;
  } catch (error) {
    logger.error("Failed to fetch service requests:", error);
    throw new Error("Database query failed while retrieving service requests.");
  }
}