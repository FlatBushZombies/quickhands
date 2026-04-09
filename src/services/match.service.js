import logger from '#config/logger.js';
import { sql } from '#config/database.js';
import { annotateLocationMatch, hasCoordinates, normalizeLocationPayload } from '#utils/location.js';

function normalizeTerm(term) {
  return String(term || '').trim().toLowerCase();
}

function escapeLikePattern(value) {
  return String(value).replace(/[\\%_]/g, '\\$&');
}

function buildMetadataLocation(metadata) {
  const safeMetadata = metadata && typeof metadata === "object" ? metadata : {};
  return normalizeLocationPayload(safeMetadata.location || {});
}

export async function findUsersMatchingJob({ serviceType, selectedServices, jobLocation, radiusKm }) {
  try {
    const baseTerms = [];
    if (serviceType) baseTerms.push(serviceType);
    if (Array.isArray(selectedServices)) baseTerms.push(...selectedServices);

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
        SELECT id, clerk_id, metadata
        FROM users
        WHERE skills IS NOT NULL
          AND (${whereClause})
      `,
      patterns
    );

    const normalizedJobLocation = normalizeLocationPayload(jobLocation || {});
    const matched = result
      .map((row) => {
        const freelancerLocation = buildMetadataLocation(row.metadata);
        const locationMatch = annotateLocationMatch({
          viewerLocation: normalizedJobLocation,
          targetLocation: freelancerLocation,
          radiusKm,
        });

        return {
          id: row.id,
          clerkId: row.clerk_id,
          location: freelancerLocation,
          locationMatch,
        };
      })
      .filter((matchedUser) => {
        if (!hasCoordinates(normalizedJobLocation)) {
          return true;
        }

        return matchedUser.locationMatch.inYourArea;
      })
      .sort((left, right) => {
        const leftDistance = left.locationMatch.distanceKm ?? Number.MAX_SAFE_INTEGER;
        const rightDistance = right.locationMatch.distanceKm ?? Number.MAX_SAFE_INTEGER;
        return leftDistance - rightDistance;
      });

    logger.info(
      `findUsersMatchingJob: matched ${matched.length} users for terms=${JSON.stringify(terms)}`
    );
    return matched;
  } catch (error) {
    logger.error('findUsersMatchingJob DB error', error);
    throw new Error('Failed to match users for job');
  }
}
