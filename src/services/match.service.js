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
    const result = await sql`
      SELECT id, clerk_id, skills, metadata
      FROM users
      WHERE clerk_id IS NOT NULL;
    `;

    const normalizedJobLocation = normalizeLocationPayload(jobLocation || {});
    const hasNearbyCoordinates = hasCoordinates(normalizedJobLocation);
    const matched = result
      .map((row) => {
        const freelancerLocation = buildMetadataLocation(row.metadata);
        const locationMatch = annotateLocationMatch({
          viewerLocation: normalizedJobLocation,
          targetLocation: freelancerLocation,
          radiusKm,
        });
        const normalizedSkills = normalizeTerm(row.skills || "");
        const skillMatch =
          terms.length === 0
            ? true
            : terms.some((term) => normalizedSkills.includes(term));

        return {
          id: row.id,
          clerkId: row.clerk_id,
          skillMatch,
          location: freelancerLocation,
          locationMatch,
        };
      })
      .filter((matchedUser) => {
        if (hasNearbyCoordinates) {
          return matchedUser.locationMatch.inYourArea;
        }

        return matchedUser.skillMatch;
      })
      .sort((left, right) => {
        const leftSkillRank = left.skillMatch ? 0 : 1;
        const rightSkillRank = right.skillMatch ? 0 : 1;
        if (leftSkillRank !== rightSkillRank) {
          return leftSkillRank - rightSkillRank;
        }

        const leftDistance = left.locationMatch.distanceKm ?? Number.MAX_SAFE_INTEGER;
        const rightDistance = right.locationMatch.distanceKm ?? Number.MAX_SAFE_INTEGER;
        return leftDistance - rightDistance;
      })
      .slice(0, 25);

    logger.info(
      `findUsersMatchingJob: matched ${matched.length} users for terms=${JSON.stringify(terms)}`
    );
    return matched;
  } catch (error) {
    logger.error('findUsersMatchingJob DB error', error);
    throw new Error('Failed to match users for job');
  }
}
