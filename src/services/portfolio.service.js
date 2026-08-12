import logger from "#config/logger.js";
import { sql } from "#config/database.js";
import { notifyUser } from "#services/notifications.service.js";

const MAX_MEDIA_PER_PROJECT = 6;
const VIEW_DEDUP_WINDOW_MINUTES = 30;

function transformMedia(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    url: row.media_url,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

function transformProject(row, media = []) {
  return {
    id: row.id,
    specialistClerkId: row.specialist_clerk_id,
    title: row.title,
    description: row.description,
    category: row.category,
    skills: row.skills,
    projectUrl: row.project_url,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    media: media.map(transformMedia),
  };
}

export async function getPortfolioForSpecialist(specialistClerkId) {
  try {
    const projectRows = await sql`
      SELECT * FROM portfolio_projects
      WHERE specialist_clerk_id = ${specialistClerkId}
      ORDER BY sort_order ASC, created_at ASC;
    `;

    if (projectRows.length === 0) {
      return { projects: [] };
    }

    const projectIds = projectRows.map((row) => row.id);
    const mediaRows = await sql`
      SELECT * FROM portfolio_media
      WHERE project_id = ANY(${projectIds})
      ORDER BY sort_order ASC, created_at ASC;
    `;

    const mediaByProjectId = new Map();
    for (const row of mediaRows) {
      const existing = mediaByProjectId.get(row.project_id) || [];
      existing.push(row);
      mediaByProjectId.set(row.project_id, existing);
    }

    return {
      projects: projectRows.map((row) =>
        transformProject(row, mediaByProjectId.get(row.id) || [])
      ),
    };
  } catch (error) {
    logger.error(`getPortfolioForSpecialist DB error for clerk_id=${specialistClerkId}:`, error);
    throw new Error("Failed to load portfolio");
  }
}

async function getOwnedProject(projectId, specialistClerkId) {
  const rows = await sql`
    SELECT * FROM portfolio_projects WHERE id = ${projectId};
  `;
  const project = rows[0];
  if (!project || project.specialist_clerk_id !== specialistClerkId) {
    return null;
  }
  return project;
}

export async function createProject(specialistClerkId, { title, description, category, skills, projectUrl }) {
  try {
    const maxOrderRows = await sql`
      SELECT COALESCE(MAX(sort_order), -1) AS max_order
      FROM portfolio_projects
      WHERE specialist_clerk_id = ${specialistClerkId};
    `;
    const nextOrder = Number(maxOrderRows[0]?.max_order ?? -1) + 1;

    const result = await sql`
      INSERT INTO portfolio_projects
        (specialist_clerk_id, title, description, category, skills, project_url, sort_order, created_at, updated_at)
      VALUES
        (${specialistClerkId}, ${title}, ${description || null}, ${category || null}, ${skills || null}, ${projectUrl || null}, ${nextOrder}, NOW(), NOW())
      RETURNING *;
    `;

    return transformProject(result[0], []);
  } catch (error) {
    logger.error(`createProject DB error for clerk_id=${specialistClerkId}:`, error);
    throw new Error("Failed to create portfolio project");
  }
}

export async function updateProject(projectId, specialistClerkId, { title, description, category, skills, projectUrl }) {
  try {
    const owned = await getOwnedProject(projectId, specialistClerkId);
    if (!owned) {
      return null;
    }

    const result = await sql`
      UPDATE portfolio_projects
      SET
        title = ${title ?? owned.title},
        description = ${description !== undefined ? description : owned.description},
        category = ${category !== undefined ? category : owned.category},
        skills = ${skills !== undefined ? skills : owned.skills},
        project_url = ${projectUrl !== undefined ? projectUrl : owned.project_url},
        updated_at = NOW()
      WHERE id = ${projectId}
      RETURNING *;
    `;

    const mediaRows = await sql`
      SELECT * FROM portfolio_media WHERE project_id = ${projectId} ORDER BY sort_order ASC, created_at ASC;
    `;

    return transformProject(result[0], mediaRows);
  } catch (error) {
    logger.error(`updateProject DB error for project_id=${projectId}:`, error);
    throw new Error("Failed to update portfolio project");
  }
}

export async function deleteProject(projectId, specialistClerkId) {
  try {
    const owned = await getOwnedProject(projectId, specialistClerkId);
    if (!owned) {
      return false;
    }

    await sql`DELETE FROM portfolio_projects WHERE id = ${projectId};`;
    return true;
  } catch (error) {
    logger.error(`deleteProject DB error for project_id=${projectId}:`, error);
    throw new Error("Failed to delete portfolio project");
  }
}

export async function reorderProjects(specialistClerkId, orderedProjectIds) {
  try {
    const ownedRows = await sql`
      SELECT id FROM portfolio_projects WHERE specialist_clerk_id = ${specialistClerkId};
    `;
    const ownedIds = new Set(ownedRows.map((row) => row.id));

    const requestedIds = orderedProjectIds.map((id) => Number(id));
    const allOwned = requestedIds.every((id) => ownedIds.has(id));
    if (!allOwned || requestedIds.length === 0) {
      throw new Error("Reorder payload contains a project that does not belong to this specialist");
    }

    for (let index = 0; index < requestedIds.length; index += 1) {
      await sql`
        UPDATE portfolio_projects
        SET sort_order = ${index}, updated_at = NOW()
        WHERE id = ${requestedIds[index]};
      `;
    }

    return getPortfolioForSpecialist(specialistClerkId);
  } catch (error) {
    logger.error(`reorderProjects DB error for clerk_id=${specialistClerkId}:`, error);
    throw error;
  }
}

export async function addMedia(projectId, specialistClerkId, mediaUrl) {
  try {
    const owned = await getOwnedProject(projectId, specialistClerkId);
    if (!owned) {
      return null;
    }

    const countRows = await sql`
      SELECT COUNT(*) AS total FROM portfolio_media WHERE project_id = ${projectId};
    `;
    const currentCount = Number.parseInt(countRows[0]?.total, 10) || 0;
    if (currentCount >= MAX_MEDIA_PER_PROJECT) {
      throw new Error(`A project can have at most ${MAX_MEDIA_PER_PROJECT} images`);
    }

    const result = await sql`
      INSERT INTO portfolio_media (project_id, media_url, sort_order, created_at)
      VALUES (${projectId}, ${mediaUrl}, ${currentCount}, NOW())
      RETURNING *;
    `;

    return transformMedia(result[0]);
  } catch (error) {
    logger.error(`addMedia DB error for project_id=${projectId}:`, error);
    throw error;
  }
}

export async function removeMedia(mediaId, specialistClerkId) {
  try {
    const rows = await sql`
      SELECT m.id, m.project_id, p.specialist_clerk_id
      FROM portfolio_media m
      JOIN portfolio_projects p ON p.id = m.project_id
      WHERE m.id = ${mediaId};
    `;
    const media = rows[0];
    if (!media || media.specialist_clerk_id !== specialistClerkId) {
      return false;
    }

    await sql`DELETE FROM portfolio_media WHERE id = ${mediaId};`;
    return true;
  } catch (error) {
    logger.error(`removeMedia DB error for media_id=${mediaId}:`, error);
    throw new Error("Failed to remove portfolio media");
  }
}

/**
 * Records a portfolio view and notifies the specialist, with two layers of
 * dedup: the client guards against re-render-triggered duplicate calls with
 * a ref, and this is the spoof-proof server-side layer -- repeat views from
 * the same viewer within VIEW_DEDUP_WINDOW_MINUTES are treated as the same
 * browsing session (no new row, no repeat notification), not new events.
 * viewerClerkId must come from the verified auth token, never request body.
 */
export async function recordPortfolioView({ specialistClerkId, viewerClerkId, projectId = null }) {
  try {
    if (!viewerClerkId || viewerClerkId === specialistClerkId) {
      return { recorded: false };
    }

    const dedupCutoff = new Date(Date.now() - VIEW_DEDUP_WINDOW_MINUTES * 60 * 1000).toISOString();
    const recentRows = await sql`
      SELECT id FROM portfolio_views
      WHERE specialist_clerk_id = ${specialistClerkId}
        AND viewer_clerk_id = ${viewerClerkId}
        AND created_at > ${dedupCutoff}
      LIMIT 1;
    `;

    if (recentRows.length > 0) {
      return { recorded: false };
    }

    await sql`
      INSERT INTO portfolio_views (specialist_clerk_id, viewer_clerk_id, project_id, created_at)
      VALUES (${specialistClerkId}, ${viewerClerkId}, ${projectId}, NOW());
    `;

    let message = "A client viewed your portfolio.";
    if (projectId) {
      const projectRows = await sql`
        SELECT title FROM portfolio_projects WHERE id = ${projectId};
      `;
      if (projectRows[0]?.title) {
        message = `A client viewed your project "${projectRows[0].title}".`;
      }
    }

    await notifyUser({
      clerkId: specialistClerkId,
      jobId: null,
      message,
      type: "portfolio_view",
    });

    return { recorded: true };
  } catch (error) {
    logger.error(`recordPortfolioView DB error for specialist_clerk_id=${specialistClerkId}:`, error);
    throw new Error("Failed to record portfolio view");
  }
}
