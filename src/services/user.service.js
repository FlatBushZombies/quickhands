import { neon } from "@neondatabase/serverless";
import logger from "#config/logger.js";

const sql = neon(process.env.DATABASE_URL);

/**
 * Transform database user object to camelCase for API response
 * @param {Object} user - User object from database
 * @returns {Object} - Transformed user object
 */
function transformUser(user) {
  return {
    id: user.id,
    clerkId: user.clerk_id,
    name: user.name,
    skills: user.skills,
    experienceLevel: user.experience_level,
    hourlyRate: user.hourly_rate,
    // Onboarding flag (defaults to false if column is missing/null)
    completedOnboarding: user.completed_onboarding === true,
    createdAt: user.created_at,
    updatedAt: user.updated_at
  };
}

/**
 * Upsert user onboarding information
 * Creates new user if clerk_id doesn't exist, otherwise updates existing user
 * @param {Object} userData - User data object
 * @param {string} userData.clerkId - Clerk user ID (required)
 * @param {string} userData.name - User's name
 * @param {string} userData.skills - User's skills
 * @param {string} userData.experienceLevel - User's experience level
 * @param {number} userData.hourlyRate - User's hourly rate
 * @returns {Object} - Updated or created user object
 * @throws {Error} - Database operation error
 */
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
    // Use PostgreSQL UPSERT (ON CONFLICT) to handle both insert and update
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

/**
 * Get user by Clerk ID
 * @param {string} clerkId - Clerk user ID
 * @returns {Object|null} - User object or null if not found
 */
export async function getUserByClerkId(clerkId) {
  try {
    const result = await sql`
      SELECT * FROM users 
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