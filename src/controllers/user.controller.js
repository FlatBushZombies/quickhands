import logger from '#config/logger.js';
import {
  addFavoriteFreelancer,
  addSavedSearch,
  findClientsMatchingFreelancer,
  getClerkIdByDeviceLocationToken,
  getClientAnalytics,
  getOrCreateDeviceLocationToken,
  getUserByClerkId,
  listFavoriteFreelancers,
  listSavedSearches,
  registerPushTokenByClerkId,
  removeFavoriteFreelancer,
  removeSavedSearch,
  unregisterPushTokenByClerkId,
  updateUserLocationByClerkId,
  upsertUser,
} from '#services/user.service.js';
import { notifyUser } from '#services/notifications.service.js';
import {
  deleteJobTemplate,
  listJobTemplates,
  saveJobTemplate,
} from '#services/templates.service.js';
import { listReceivedReviews } from '#services/reviews.service.js';
import { normalizeLocationPayload } from '#utils/location.js';
import { checkJobProximityForFreelancer } from '#services/proximity.service.js';

/**
 * Shared by both the Clerk-authed PATCH /user/location controller and the
 * device-token-authed POST /user/location/ping controller (used by the
 * freelance app's background location task, which has no Clerk session to
 * refresh) — keeps the update+proximity-check pairing in one place.
 */
async function applyFreelancerLocationUpdate(clerkId, location) {
  const user = await updateUserLocationByClerkId(clerkId, location);

  checkJobProximityForFreelancer(clerkId, location).catch((proximityError) => {
    logger.error(`Proximity check failed for clerk_id=${clerkId}:`, proximityError);
  });

  return user;
}

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

/**
 * Notifies clients whose saved search matches a freelancer who just
 * finished onboarding — the reverse of the job_match notification
 * freelancers already get. Fire-and-forget; failures are logged, never
 * block the onboarding response.
 */
async function notifyMatchingClientsAboutNewFreelancer({ clerkId, skills, hourlyRate }) {
  try {
    const matchedClerkIds = await findClientsMatchingFreelancer({ skills, hourlyRate });
    await Promise.all(
      matchedClerkIds.map((clientClerkId) =>
        notifyUser({
          clerkId: clientClerkId,
          message: `A new specialist matching your saved search (${skills}) just joined.`,
          type: 'freelancer_match',
        }).catch((notifyError) => {
          logger.error('Error notifying client about matching freelancer', notifyError);
        })
      )
    );
  } catch (error) {
    logger.error(`notifyMatchingClientsAboutNewFreelancer failed for clerk_id=${clerkId}:`, error);
  }
}

export const updateUserOnboarding = async (req, res) => {
  const { clerkId, name, email, imageUrl, skills, experienceLevel, hourlyRate, completedOnboarding } = req.body || {};

  try {
    if (!clerkId || typeof clerkId !== 'string' || clerkId.trim().length === 0) {
      logger.warn('Missing clerkId in updateUserOnboarding request');
      return res.status(400).json({ error: 'Clerk ID is required' });
    }

    logger.info(`Updating user onboarding for clerk_id=${clerkId}`);

    const existingUser = await getUserByClerkId(clerkId).catch(() => null);
    const wasOnboarded = existingUser?.completedOnboarding === true;

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

    // Only fire on the transition into "onboarded", not on every later
    // profile edit — otherwise a freelancer tweaking their bio would
    // re-notify every client with a matching saved search each time.
    if (!wasOnboarded && user?.completedOnboarding === true && skills) {
      void notifyMatchingClientsAboutNewFreelancer({ clerkId, skills, hourlyRate });
    }

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

    const user = await applyFreelancerLocationUpdate(clerkId, location);

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

/**
 * Clerk-authed. Called once from the foreground app to fetch (or create)
 * the opaque device-location token, which is then cached in SecureStore and
 * used by the background location task instead of a Clerk session JWT.
 */
export const getDeviceLocationToken = async (req, res) => {
  try {
    if (!req.user?.clerkId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const token = await getOrCreateDeviceLocationToken(req.user.clerkId);
    return res.status(200).json({ success: true, token });
  } catch (error) {
    logger.error(`Failed to get device location token for clerk_id=${req.user?.clerkId}:`, error);
    return res.status(500).json({ success: false, message: 'Failed to get device location token' });
  }
};

/**
 * NOT Clerk-authed — gated by the opaque device-location token in the body
 * instead, since this is called from a background task with no React tree
 * to refresh a Clerk session JWT. Only allows posting a lat/long; nothing
 * more sensitive is exposed through this path.
 */
export const pingLocation = async (req, res) => {
  const { deviceLocationToken } = req.body || {};

  try {
    if (typeof deviceLocationToken !== 'string' || !deviceLocationToken.trim()) {
      return res.status(400).json({ error: 'deviceLocationToken is required' });
    }

    const clerkId = await getClerkIdByDeviceLocationToken(deviceLocationToken.trim());
    if (!clerkId) {
      return res.status(401).json({ error: 'Invalid device location token' });
    }

    const location = normalizeLocationPayload(req.body || {});
    if (location.latitude === null || location.longitude === null) {
      return res.status(400).json({ error: 'A valid latitude and longitude are required' });
    }

    await applyFreelancerLocationUpdate(clerkId, location);

    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Failed to process background location ping:', error);
    return res.status(500).json({ error: 'Failed to process location ping' });
  }
};

export const registerMyPushToken = async (req, res) => {
  try {
    if (!req.user?.clerkId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { token, platform, appRole } = req.body || {};
    await registerPushTokenByClerkId(req.user.clerkId, token, platform, appRole);

    return res.status(200).json({
      success: true,
      registered: true,
    });
  } catch (error) {
    logger.error(`Failed to register push token for clerk_id=${req.user?.clerkId}:`, error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to register push token' });
  }
};

export const unregisterMyPushToken = async (req, res) => {
  try {
    if (!req.user?.clerkId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { token } = req.body || {};
    await unregisterPushTokenByClerkId(req.user.clerkId, token);

    return res.status(200).json({
      success: true,
      removed: true,
    });
  } catch (error) {
    logger.error(`Failed to unregister push token for clerk_id=${req.user?.clerkId}:`, error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to unregister push token' });
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

// ─── Favorites ───────────────────────────────────────────────────────────

export const getMyFavoriteFreelancers = async (req, res) => {
  try {
    if (!req.user?.clerkId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const favorites = await listFavoriteFreelancers(req.user.clerkId);
    return res.status(200).json({ success: true, favorites });
  } catch (error) {
    logger.error(`Failed to list favorites for clerk_id=${req.user?.clerkId}:`, error);
    return res.status(500).json({ success: false, message: 'Failed to fetch favorites' });
  }
};

export const addMyFavoriteFreelancer = async (req, res) => {
  try {
    if (!req.user?.clerkId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    await addFavoriteFreelancer(req.user.clerkId, req.params.freelancerClerkId);
    return res.status(200).json({ success: true, added: true });
  } catch (error) {
    logger.error(`Failed to add favorite for clerk_id=${req.user?.clerkId}:`, error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to add favorite' });
  }
};

export const removeMyFavoriteFreelancer = async (req, res) => {
  try {
    if (!req.user?.clerkId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    await removeFavoriteFreelancer(req.user.clerkId, req.params.freelancerClerkId);
    return res.status(200).json({ success: true, removed: true });
  } catch (error) {
    logger.error(`Failed to remove favorite for clerk_id=${req.user?.clerkId}:`, error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to remove favorite' });
  }
};

// ─── Saved search alerts ─────────────────────────────────────────────────

export const getMySavedSearches = async (req, res) => {
  try {
    if (!req.user?.clerkId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const savedSearches = await listSavedSearches(req.user.clerkId);
    return res.status(200).json({ success: true, savedSearches });
  } catch (error) {
    logger.error(`Failed to list saved searches for clerk_id=${req.user?.clerkId}:`, error);
    return res.status(500).json({ success: false, message: 'Failed to fetch saved searches' });
  }
};

export const addMySavedSearch = async (req, res) => {
  try {
    if (!req.user?.clerkId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { category, minBudget, maxBudget } = req.body || {};
    const savedSearch = await addSavedSearch(req.user.clerkId, { category, minBudget, maxBudget });
    return res.status(201).json({ success: true, savedSearch });
  } catch (error) {
    logger.error(`Failed to add saved search for clerk_id=${req.user?.clerkId}:`, error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to add saved search' });
  }
};

export const removeMySavedSearch = async (req, res) => {
  try {
    if (!req.user?.clerkId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    await removeSavedSearch(req.user.clerkId, req.params.savedSearchId);
    return res.status(200).json({ success: true, removed: true });
  } catch (error) {
    logger.error(`Failed to remove saved search for clerk_id=${req.user?.clerkId}:`, error);
    return res.status(400).json({ success: false, message: error.message || 'Failed to remove saved search' });
  }
};

// ─── Client analytics ────────────────────────────────────────────────────

export const getMyClientAnalytics = async (req, res) => {
  try {
    if (!req.user?.clerkId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const analytics = await getClientAnalytics(req.user.clerkId);
    return res.status(200).json({ success: true, analytics });
  } catch (error) {
    logger.error(`Failed to compute analytics for clerk_id=${req.user?.clerkId}:`, error);
    return res.status(500).json({ success: false, message: 'Failed to compute analytics' });
  }
};
