import logger from '#config/logger.js';
import { upsertUser, getUserByClerkId } from '#services/user.service.js';

/**
 * Create or register a user coming from Clerk sign-up / OAuth
 * POST /api/user
 * Body: { clerkId (required), name, email? }
 *
 * We store minimal profile now and let onboarding/profile screens enrich it later.
 */
export const createOrRegisterUser = async (req, res) => {
  const { clerkId, name } = req.body || {};

  try {
    if (!clerkId || typeof clerkId !== 'string' || clerkId.trim().length === 0) {
      logger.warn('Missing clerkId in createOrRegisterUser request');
      return res.status(400).json({ error: 'Clerk ID is required' });
    }

    logger.info(`Creating or registering user for clerk_id=${clerkId}`);

    const user = await upsertUser({
      clerkId,
      name,
      skills: null,
      experienceLevel: null,
      hourlyRate: null,
      completedOnboarding: false,
    });

    logger.info(`User registered successfully for clerk_id=${clerkId}`);
    return res.status(201).json({ success: true, user });
  } catch (error) {
    logger.error(`Failed to create/register user for clerk_id=${clerkId}:`, error);
    return res.status(500).json({ error: 'Failed to create user' });
  }
};

/**
 * Fetch user by Clerk ID
 * GET /api/user/:clerkId
 *
 * Used by the mobile app to check onboarding state and prefill profile.
 */
export const getUserProfileByClerkId = async (req, res) => {
  const { clerkId } = req.params || {};

  try {
    if (!clerkId || typeof clerkId !== 'string' || clerkId.trim().length === 0) {
      logger.warn('Missing clerkId in getUserProfileByClerkId request');
      return res.status(400).json({ error: 'Clerk ID is required' });
    }

    const user = await getUserByClerkId(clerkId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    logger.error(`Failed to fetch user profile for clerk_id=${clerkId}:`, error);
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
};

/**
 * Update or insert user onboarding information
 * Expects JSON body with: clerkId (required), name, skills, experienceLevel, hourlyRate, completedOnboarding?
 */
export const updateUserOnboarding = async (req, res) => {
  const { clerkId, name, skills, experienceLevel, hourlyRate, completedOnboarding } = req.body || {};

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
      // Default to true when this path is called from onboarding/profile
      completedOnboarding: completedOnboarding ?? true,
    });

    logger.info(`User onboarding updated successfully for clerk_id=${clerkId}`);
    return res.status(200).json({ success: true, user });
  } catch (error) {
    logger.error(`Failed to update user onboarding for clerk_id=${clerkId}:`, error);
    return res.status(500).json({ error: 'Failed to update user' });
  }
};