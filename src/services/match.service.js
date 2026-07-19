import logger from '#config/logger.js';
import { sql } from '#config/database.js';
import {
  annotateLocationMatch,
  DEFAULT_NEARBY_RADIUS_KM,
  hasCoordinates,
  normalizeLocationPayload,
} from '#utils/location.js';

function normalizeTerm(term) {
  return String(term || '').trim().toLowerCase();
}

function buildMetadataLocation(metadata) {
  const safeMetadata = metadata && typeof metadata === "object" ? metadata : {};
  return normalizeLocationPayload(safeMetadata.location || {});
}

const MATCH_QUERY_ROW_LIMIT = 500;

/**
 * Rough bounding box in degrees for a radius in km, so the DB can prune
 * candidates before the precise Haversine calc runs in JS. Longitude
 * degrees shrink toward the poles, so it's scaled by cos(latitude);
 * clamped so it never blows up near +/-90.
 */
function boundingBoxForRadius(origin, radiusKm) {
  const latDeltaDeg = radiusKm / 111;
  const lonDeltaDeg = radiusKm / (111 * Math.max(Math.cos((origin.latitude * Math.PI) / 180), 0.01));

  return {
    minLat: origin.latitude - latDeltaDeg,
    maxLat: origin.latitude + latDeltaDeg,
    minLon: origin.longitude - lonDeltaDeg,
    maxLon: origin.longitude + lonDeltaDeg,
  };
}

export async function findUsersMatchingJob({ serviceType, selectedServices, jobLocation, radiusKm, excludeClerkId }) {
  try {
    const baseTerms = [];
    if (serviceType) baseTerms.push(serviceType);
    if (Array.isArray(selectedServices)) baseTerms.push(...selectedServices);

    const terms = Array.from(new Set(baseTerms.map(normalizeTerm))).filter(Boolean);
    const normalizedJobLocation = normalizeLocationPayload(jobLocation || {});
    const hasNearbyCoordinates = hasCoordinates(normalizedJobLocation);
    const effectiveRadiusKm = radiusKm || DEFAULT_NEARBY_RADIUS_KM;

    let result;
    if (hasNearbyCoordinates) {
      const { minLat, maxLat, minLon, maxLon } = boundingBoxForRadius(
        normalizedJobLocation,
        effectiveRadiusKm
      );

      result = await sql`
        SELECT id, clerk_id, skills, metadata
        FROM users
        WHERE clerk_id IS NOT NULL
          AND clerk_id IS DISTINCT FROM ${excludeClerkId || null}
          AND metadata->>'appRole' IS DISTINCT FROM 'client'
          AND metadata->'location'->>'latitude' ~ '^-?[0-9]+\.?[0-9]*$'
          AND metadata->'location'->>'longitude' ~ '^-?[0-9]+\.?[0-9]*$'
          AND (metadata->'location'->>'latitude')::numeric BETWEEN ${minLat} AND ${maxLat}
          AND (metadata->'location'->>'longitude')::numeric BETWEEN ${minLon} AND ${maxLon}
        LIMIT ${MATCH_QUERY_ROW_LIMIT};
      `;
    } else if (terms.length > 0) {
      const likeTerms = terms.map((term) => `%${term}%`);
      result = await sql`
        SELECT id, clerk_id, skills, metadata
        FROM users
        WHERE clerk_id IS NOT NULL
          AND clerk_id IS DISTINCT FROM ${excludeClerkId || null}
          AND metadata->>'appRole' IS DISTINCT FROM 'client'
          AND skills ILIKE ANY(${likeTerms})
        LIMIT ${MATCH_QUERY_ROW_LIMIT};
      `;
    } else {
      result = await sql`
        SELECT id, clerk_id, skills, metadata
        FROM users
        WHERE clerk_id IS NOT NULL
          AND clerk_id IS DISTINCT FROM ${excludeClerkId || null}
          AND metadata->>'appRole' IS DISTINCT FROM 'client'
        LIMIT ${MATCH_QUERY_ROW_LIMIT};
      `;
    }

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
