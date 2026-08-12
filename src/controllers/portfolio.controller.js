import logger from "#config/logger.js";
import { getUserByClerkId, getReviewSummaryByClerkId } from "#services/user.service.js";
import {
  addMedia,
  createProject,
  deleteProject,
  getPortfolioForSpecialist,
  recordPortfolioView,
  removeMedia,
  reorderProjects,
  updateProject,
} from "#services/portfolio.service.js";

function asTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export async function getMyPortfolioController(req, res) {
  try {
    const portfolio = await getPortfolioForSpecialist(req.user.clerkId);
    return res.status(200).json({ success: true, data: portfolio });
  } catch (error) {
    logger.error("getMyPortfolioController error", error);
    return res.status(500).json({ success: false, message: "Failed to load your portfolio" });
  }
}

export async function getSpecialistPortfolioController(req, res) {
  try {
    const { clerkId } = req.params;
    const specialist = await getUserByClerkId(clerkId);

    if (!specialist) {
      return res.status(404).json({ success: false, message: "Specialist not found" });
    }

    const [portfolio, reviewSummary] = await Promise.all([
      getPortfolioForSpecialist(clerkId),
      getReviewSummaryByClerkId(clerkId),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        specialist: {
          clerkId: specialist.clerkId,
          name: specialist.name,
          imageUrl: specialist.imageUrl,
          skills: specialist.skills,
          experienceLevel: specialist.experienceLevel,
          hourlyRate: specialist.hourlyRate,
          reviewSummary,
        },
        projects: portfolio.projects,
      },
    });
  } catch (error) {
    logger.error("getSpecialistPortfolioController error", error);
    return res.status(500).json({ success: false, message: "Failed to load portfolio" });
  }
}

export async function createProjectController(req, res) {
  try {
    const title = asTrimmedString(req.body?.title);
    if (!title) {
      return res.status(400).json({ success: false, message: "Title is required" });
    }

    const project = await createProject(req.user.clerkId, {
      title,
      description: asTrimmedString(req.body?.description) || null,
      category: asTrimmedString(req.body?.category) || null,
      skills: asTrimmedString(req.body?.skills) || null,
      projectUrl: asTrimmedString(req.body?.projectUrl) || null,
    });

    return res.status(201).json({ success: true, data: project });
  } catch (error) {
    logger.error("createProjectController error", error);
    return res.status(500).json({ success: false, message: "Failed to create portfolio project" });
  }
}

export async function updateProjectController(req, res) {
  try {
    const { id } = req.params;
    const updates = {};
    if (req.body?.title !== undefined) updates.title = asTrimmedString(req.body.title);
    if (req.body?.description !== undefined) updates.description = asTrimmedString(req.body.description) || null;
    if (req.body?.category !== undefined) updates.category = asTrimmedString(req.body.category) || null;
    if (req.body?.skills !== undefined) updates.skills = asTrimmedString(req.body.skills) || null;
    if (req.body?.projectUrl !== undefined) updates.projectUrl = asTrimmedString(req.body.projectUrl) || null;

    if (updates.title === "") {
      return res.status(400).json({ success: false, message: "Title cannot be empty" });
    }

    const project = await updateProject(id, req.user.clerkId, updates);
    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    return res.status(200).json({ success: true, data: project });
  } catch (error) {
    logger.error("updateProjectController error", error);
    return res.status(500).json({ success: false, message: "Failed to update portfolio project" });
  }
}

export async function deleteProjectController(req, res) {
  try {
    const { id } = req.params;
    const deleted = await deleteProject(id, req.user.clerkId);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error("deleteProjectController error", error);
    return res.status(500).json({ success: false, message: "Failed to delete portfolio project" });
  }
}

export async function reorderProjectsController(req, res) {
  try {
    const orderedProjectIds = req.body?.orderedProjectIds;
    if (!Array.isArray(orderedProjectIds) || orderedProjectIds.length === 0) {
      return res.status(400).json({ success: false, message: "orderedProjectIds must be a non-empty array" });
    }

    const portfolio = await reorderProjects(req.user.clerkId, orderedProjectIds);
    return res.status(200).json({ success: true, data: portfolio });
  } catch (error) {
    logger.error("reorderProjectsController error", error);
    return res.status(400).json({ success: false, message: error.message || "Failed to reorder portfolio" });
  }
}

export async function addMediaController(req, res) {
  try {
    const { id } = req.params;
    const mediaUrl = asTrimmedString(req.body?.mediaUrl);
    if (!mediaUrl) {
      return res.status(400).json({ success: false, message: "mediaUrl is required" });
    }

    const media = await addMedia(id, req.user.clerkId, mediaUrl);
    if (!media) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    return res.status(201).json({ success: true, data: media });
  } catch (error) {
    logger.error("addMediaController error", error);
    return res.status(400).json({ success: false, message: error.message || "Failed to add media" });
  }
}

export async function removeMediaController(req, res) {
  try {
    const { id } = req.params;
    const removed = await removeMedia(id, req.user.clerkId);
    if (!removed) {
      return res.status(404).json({ success: false, message: "Media not found" });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error("removeMediaController error", error);
    return res.status(500).json({ success: false, message: "Failed to remove media" });
  }
}

export async function recordPortfolioViewController(req, res) {
  try {
    const { clerkId } = req.params;
    const projectId = req.body?.projectId ? Number(req.body.projectId) : null;

    const result = await recordPortfolioView({
      specialistClerkId: clerkId,
      viewerClerkId: req.user.clerkId,
      projectId,
    });

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    logger.error("recordPortfolioViewController error", error);
    return res.status(500).json({ success: false, message: "Failed to record portfolio view" });
  }
}
