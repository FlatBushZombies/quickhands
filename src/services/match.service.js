import logger from '#config/logger.js';
import { sql } from '#config/database.js';

function normalizeTerm(t) {
  return String(t || '').trim().toLowerCase();
}

function escapeLikePattern(value) {
  return String(value).replace(/[\\%_]/g, '\\$&');
}

export async function findUsersMatchingJob({ serviceType, selectedServices }) {
  try {
    const baseTerms = [];
    if (serviceType) baseTerms.push(serviceType);
    if (Array.isArray(selectedServices)) baseTerms.push(...selectedServices);

    // Deduplicate and clean
    const terms = Array.from(new Set(baseTerms.map(normalizeTerm))).filter(Boolean);
    if (terms.length === 0) {
      logger.info('findUsersMatchingJob: no terms provided');
      return [];
    }

    const patterns = terms.map((term) => `%${escapeLikePattern(term)}%`);
    const whereClause = patterns
      .map((_, index) => `LOWER(skills) LIKE LOWER($${index + 1}) ESCAPE '\\'`)
      .join(' OR ');

    const result = await sql.query(
      `
        SELECT id, clerk_id
        FROM users
        WHERE skills IS NOT NULL
          AND (${whereClause})
      `,
      patterns
    );

    const matched = result.map((row) => ({ id: row.id, clerkId: row.clerk_id }));

    logger.info(`findUsersMatchingJob: matched ${matched.length} users for terms=${JSON.stringify(terms)}`);
    return matched;
  } catch (e) {
    logger.error('findUsersMatchingJob DB error', e);
    throw new Error('Failed to match users for job');
  }
}
