import logger from '#config/logger.js';
import { upsertUser } from '#services/user.service.js';

/**
 * Update or insert user onboarding information
 * Expects JSON body with: clerkId (required), name, skills, experienceLevel, hourlyRate
 */
export const updateUserOnboarding = async (req, res) => {
  const { clerkId, name, skills, experienceLevel, hourlyRate } = req.body || {};

  try {
    if (!clerkId || typeof clerkId !== 'string' || clerkId.trim().length === 0) {
      logger.warn('Missing clerkId in updateUserOnboarding request');
      return res.status(400).json({ error: 'Clerk ID is required' });
    }

    logger.info(`Updating user onboarding for clerk_id=${clerkId}`);

    const user = await upsertUser({
      clerkId,
      name,
      skills,
      experienceLevel,
      hourlyRate,
    });

    logger.info(`User onboarding updated successfully for clerk_id=${clerkId}`);
    return res.status(200).json({ success: true, user });
  } catch (error) {
    logger.error(`Failed to update user onboarding for clerk_id=${clerkId}:`, error);
    return res.status(500).json({ error: 'Failed to update user' });
  }
};