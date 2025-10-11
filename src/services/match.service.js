import { neon } from '@neondatabase/serverless';
import logger from '#config/logger.js';

const sql = neon(process.env.DATABASE_URL);

function normalizeTerm(t) {
  return String(t || '').trim().toLowerCase();
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

    // Fetch users with skills to filter in JS for simplicity/compatibility
    const result = await sql`SELECT id, clerk_id, skills FROM users WHERE skills IS NOT NULL`;

    const matched = [];
    for (const row of result) {
      const skills = String(row.skills || '').toLowerCase();
      const matches = terms.some(term => skills.includes(term));
      if (matches) {
        matched.push({ id: row.id, clerkId: row.clerk_id });
      }
    }

    logger.info(`findUsersMatchingJob: matched ${matched.length} users for terms=${JSON.stringify(terms)}`);
    return matched;
  } catch (e) {
    logger.error('findUsersMatchingJob DB error', e);
    throw new Error('Failed to match users for job');
  }
}