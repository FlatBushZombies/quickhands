import logger from "#config/logger.js";
import { sql } from "#config/database.js";
import { normalizeLocationPayload } from "#utils/location.js";

function transformUser(user) {
  const metadata = user.metadata && typeof user.metadata === "object" ? user.metadata : {};
  const location = normalizeLocationPayload(metadata.location || {});

  return {
    id: user.id,
    clerkId: user.clerk_id,
    name: user.name,
    skills: user.skills,
    experienceLevel: user.experience_level,
    hourlyRate: user.hourly_rate,
    completedOnboarding: user.completed_onboarding === true,
    location: location.label || location.city || location.latitude !== null ? location : null,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

export async function upsertUser(userData) {
  const {
    clerkId,
    name,
    skills,
    experienceLevel,
    hourlyRate,
    completedOnboarding = false,
  } = userData;

  try {
    const result = await sql`
      INSERT INTO users (
        clerk_id,
        name,
        skills,
        experience_level,
        hourly_rate,
        completed_onboarding,
        created_at,
        updated_at
      )
      VALUES (
        ${clerkId},
        ${name || null},
        ${skills || null},
        ${experienceLevel || null},
        ${hourlyRate || null},
        ${completedOnboarding},
        NOW(),
        NOW()
      )
      ON CONFLICT (clerk_id)
      DO UPDATE SET
        name = EXCLUDED.name,
        skills = EXCLUDED.skills,
        experience_level = EXCLUDED.experience_level,
        hourly_rate = EXCLUDED.hourly_rate,
        completed_onboarding = EXCLUDED.completed_onboarding,
        updated_at = NOW()
      RETURNING *;
    `;

    if (!result || result.length === 0) {
      throw new Error("No user returned from upsert operation");
    }

    const user = result[0];
    logger.info(`User upserted successfully: clerk_id=${clerkId}, id=${user.id}`);
    return transformUser(user);
  } catch (error) {
    logger.error(`Database error during user upsert for clerk_id=${clerkId}:`, error);
    throw new Error("Failed to update user in database");
  }
}

export async function getUserByClerkId(clerkId) {
  try {
    const result = await sql`
      SELECT *
      FROM users
      WHERE clerk_id = ${clerkId}
      LIMIT 1;
    `;

    if (result.length === 0) {
      return null;
    }

    logger.info(`User found: clerk_id=${clerkId}`);
    return transformUser(result[0]);
  } catch (error) {
    logger.error(`Database error getting user by clerk_id=${clerkId}:`, error);
    throw new Error("Failed to retrieve user from database");
  }
}

export async function updateUserLocationByClerkId(clerkId, locationPayload) {
  const normalizedLocation = normalizeLocationPayload(locationPayload);

  if (
    !normalizedLocation.label &&
    !normalizedLocation.city &&
    normalizedLocation.latitude === null &&
    normalizedLocation.longitude === null
  ) {
    throw new Error("Location details are required");
  }

  try {
    const result = await sql`
      SELECT *
      FROM users
      WHERE clerk_id = ${clerkId}
      LIMIT 1;
    `;

    if (result.length === 0) {
      throw new Error("User not found");
    }

    const currentRow = result[0];
    const nextMetadata = {
      ...(currentRow.metadata && typeof currentRow.metadata === "object" ? currentRow.metadata : {}),
      location: normalizedLocation,
    };

    const updated = await sql`
      UPDATE users
      SET metadata = ${nextMetadata}, updated_at = NOW()
      WHERE clerk_id = ${clerkId}
      RETURNING *;
    `;

    return transformUser(updated[0]);
  } catch (error) {
    logger.error(`updateUserLocationByClerkId error for ${clerkId}:`, error);
    throw error;
  }
}

function mapChatUserRow(row) {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};

  return {
    clerkId: row.clerk_id,
    displayName: row.full_name || row.email || "User",
    email: row.email,
    imageUrl: row.image_url || null,
    skills: row.skills || null,
    location: normalizeLocationPayload(metadata.location || {}),
  };
}

export async function listUsersForChat(excludeClerkId, opts = {}) {
  const limit = Math.min(100, Math.max(1, Number(opts.limit) || 50));
  const q = opts.q && String(opts.q).trim() ? String(opts.q).trim() : null;

  try {
    if (q) {
      const pattern = `%${q}%`;
      const result = await sql`
        SELECT id, clerk_id, email, full_name, image_url, skills, metadata
        FROM users
        WHERE clerk_id != ${excludeClerkId}
        AND (full_name ILIKE ${pattern} OR email ILIKE ${pattern})
        ORDER BY COALESCE(full_name, '') ASC, email ASC
        LIMIT ${limit}
      `;
      return result.map(mapChatUserRow);
    }

    const result = await sql`
      SELECT id, clerk_id, email, full_name, image_url, skills, metadata
      FROM users
      WHERE clerk_id != ${excludeClerkId}
      ORDER BY COALESCE(full_name, '') ASC, email ASC
      LIMIT ${limit}
    `;
    return result.map(mapChatUserRow);
  } catch (error) {
    logger.error(`listUsersForChat error:`, error);
    throw new Error("Failed to list users");
  }
}

export async function getUserChatSummary(clerkId) {
  try {
    const result = await sql`
      SELECT clerk_id, email, full_name, image_url, metadata
      FROM users
      WHERE clerk_id = ${clerkId}
      LIMIT 1
    `;
    if (result.length === 0) return null;
    return mapChatUserRow(result[0]);
  } catch (error) {
    logger.error(`getUserChatSummary error for ${clerkId}:`, error);
    throw new Error("Failed to load user");
  }
}
