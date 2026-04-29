import logger from '#config/logger.js';
import { upsertUser, getUserByClerkId, updateUserLocationByClerkId } from '#services/user.service.js';
import {
  deleteJobTemplate,
  listJobTemplates,
  saveJobTemplate,
} from '#services/templates.service.js';
import { listReceivedReviews } from '#services/reviews.service.js';
import { normalizeLocationPayload } from '#utils/location.js';

export const createOrRegisterUser = async (req, res) => {
  const { clerkId, name, email, imageUrl } = req.body || {};

  try {
    if (!clerkId || typeof clerkId !== 'string' || clerkId.trim().length === 0) {
      logger.warn('Missing clerkId in createOrRegisterUser request');
      return res.status(400).json({ error: 'Clerk ID is required' });
    }

    logger.info(`Creating or registering user for clerk_id=${clerkId}`);

    const user = await upsertUser({
      clerkId,
      name,
      email,
      imageUrl,
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

export const getUserProfileByQuery = async (req, res) => {
  req.params = {
    ...(req.params || {}),
    clerkId: req.query?.clerkId,
  };

  return getUserProfileByClerkId(req, res);
};

export const updateUserOnboarding = async (req, res) => {
  const { clerkId, name, email, imageUrl, skills, experienceLevel, hourlyRate, completedOnboarding } = req.body || {};

  try {
    if (!clerkId || typeof clerkId !== 'string' || clerkId.trim().length === 0) {
      logger.warn('Missing clerkId in updateUserOnboarding request');
      return res.status(400).json({ error: 'Clerk ID is required' });
    }

    logger.info(`Updating user onboarding for clerk_id=${clerkId}`);

    const user = await upsertUser({
      clerkId,
      name,
      email,
      imageUrl,
      skills,
      experienceLevel,
      hourlyRate,
      completedOnboarding: completedOnboarding ?? true,
    });

    logger.info(`User onboarding updated successfully for clerk_id=${clerkId}`);
    return res.status(200).json({ success: true, user });
  } catch (error) {
    logger.error(`Failed to update user onboarding for clerk_id=${clerkId}:`, error);
    return res.status(500).json({ error: 'Failed to update user' });
  }
};

export const updateUserLocation = async (req, res) => {
  const clerkId = req.body?.clerkId || req.user?.clerkId;

  try {
    if (!clerkId || typeof clerkId !== 'string' || clerkId.trim().length === 0) {
      return res.status(400).json({ error: 'Clerk ID is required' });
    }

    const location = normalizeLocationPayload(req.body || {});
    if (!location.label && !location.city && location.latitude === null && location.longitude === null) {
      return res.status(400).json({ error: 'A valid location is required' });
    }

    const user = await updateUserLocationByClerkId(clerkId, location);

    return res.status(200).json({
      success: true,
      user,
      location: user.location,
    });
  } catch (error) {
    logger.error(`Failed to update user location for clerk_id=${clerkId}:`, error);
    return res.status(
      error.message === 'User not found' || error.message === 'Location details are required' ? 404 : 500
    ).json({ error: error.message || 'Failed to update user location' });
  }
};

export const getMyJobTemplates = async (req, res) => {
  try {
    if (!req.user?.clerkId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const templates = await listJobTemplates(req.user.clerkId);
    return res.status(200).json({
      success: true,
      templates,
    });
  } catch (error) {
    logger.error(`Failed to fetch templates for clerk_id=${req.user?.clerkId}:`, error);
    return res.status(500).json({ success: false, message: 'Failed to fetch templates' });
  }
};

export const saveMyJobTemplate = async (req, res) => {
  try {
    if (!req.user?.clerkId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const template = await saveJobTemplate(req.user.clerkId, req.body || {});
    return res.status(200).json({
      success: true,
      template,
    });
  } catch (error) {
    logger.error(`Failed to save template for clerk_id=${req.user?.clerkId}:`, error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to save template' });
  }
};

export const deleteMyJobTemplate = async (req, res) => {
  try {
    if (!req.user?.clerkId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const deleted = await deleteJobTemplate(req.user.clerkId, req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    return res.status(200).json({
      success: true,
      deleted: true,
    });
  } catch (error) {
    logger.error(`Failed to delete template for clerk_id=${req.user?.clerkId}:`, error);
    return res.status(500).json({ success: false, message: 'Failed to delete template' });
  }
};

export const getUserReviews = async (req, res) => {
  const { clerkId } = req.params || {};

  try {
    if (!clerkId || typeof clerkId !== 'string' || clerkId.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Clerk ID is required' });
    }

    const { reviews, summary } = await listReceivedReviews(clerkId);
    return res.status(200).json({
      success: true,
      summary,
      reviews,
    });
  } catch (error) {
    logger.error(`Failed to fetch reviews for clerk_id=${clerkId}:`, error);
    return res.status(500).json({ success: false, message: 'Failed to fetch reviews' });
  }
};
