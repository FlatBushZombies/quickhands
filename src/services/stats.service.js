import { sql } from "#config/database.js";

export async function getPublicMarketplaceStats() {
  const [row] = await sql.query(
    `SELECT
       (SELECT COUNT(*)::int FROM users WHERE skills IS NOT NULL AND TRIM(skills) <> '') AS specialists,
       (SELECT COUNT(*)::int FROM service_request) AS jobs_posted,
       (SELECT COUNT(DISTINCT LOWER(TRIM(service_type)))::int FROM service_request
          WHERE service_type IS NOT NULL AND TRIM(service_type) <> '') AS categories,
       (SELECT ROUND(AVG((r->>'rating')::numeric), 1)
          FROM users,
               jsonb_array_elements(COALESCE(metadata->'receivedReviews', '[]'::jsonb)) AS r
          WHERE (r->>'rating') ~ '^[0-9]+(\\.[0-9]+)?$') AS average_rating`
  );

  return {
    specialists: row.specialists,
    jobsPosted: row.jobs_posted,
    categories: row.categories,
    averageRating: row.average_rating === null ? null : Number(row.average_rating),
  };
}
