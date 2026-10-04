import express from 'express';
import {
  addMyFavoriteFreelancer,
  addMySavedSearch,
  createOrRegisterUser,
  deleteMyJobTemplate,
  getDeviceLocationToken,
  getMyClientAnalytics,
  getMyFavoriteFreelancers,
  getMyJobTemplates,
  getMyExperienceController,
  getMySavedSearches,
  updateMyExperienceController,
  getUserProfileByClerkId,
  getUserProfileByQuery,
  getUserReviews,
  pingLocation,
  removeMyFavoriteFreelancer,
  removeMySavedSearch,
  saveMyJobTemplate,
  searchSpecialistsController,
  updateUserOnboarding,
  updateUserLocation,
} from '#controllers/user.controller.js';
import { requireAuth } from '#middleware/clerk.middleware.js';

const router = express.Router();

router.post('/', createOrRegisterUser);
router.get('/get', getUserProfileByQuery);
// Public — before the "/:clerkId" catch-all so it can't be shadowed.
router.get('/search/specialists', searchSpecialistsController);
router.get('/me/templates', requireAuth, getMyJobTemplates);
router.post('/me/templates', requireAuth, saveMyJobTemplate);
router.delete('/me/templates/:id', requireAuth, deleteMyJobTemplate);
router.get('/me/favorites', requireAuth, getMyFavoriteFreelancers);
router.post('/me/favorites/:freelancerClerkId', requireAuth, addMyFavoriteFreelancer);
router.delete('/me/favorites/:freelancerClerkId', requireAuth, removeMyFavoriteFreelancer);
router.get('/me/saved-searches', requireAuth, getMySavedSearches);
router.post('/me/saved-searches', requireAuth, addMySavedSearch);
router.delete('/me/saved-searches/:savedSearchId', requireAuth, removeMySavedSearch);
router.get('/me/analytics', requireAuth, getMyClientAnalytics);
router.get('/me/experience', requireAuth, getMyExperienceController);
router.put('/me/experience', requireAuth, updateMyExperienceController);
router.get('/:clerkId/reviews', getUserReviews);
router.get('/:clerkId', getUserProfileByClerkId);
router.post('/update', updateUserOnboarding);
router.patch('/location', requireAuth, updateUserLocation);
router.post('/device-location-token', requireAuth, getDeviceLocationToken);
router.post('/location/ping', pingLocation);

export default router;
