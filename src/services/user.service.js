import logger from "#config/logger.js";
import { sql } from "#config/database.js";
import { normalizeLocationPayload } from "#utils/location.js";

const USER_OPTIONAL_COLUMNS = [
  "email",
  "full_name",
  "image_url",
  "skills",
  "metadata",
  "name",
  "experience_level",
  "hourly_rate",
  "completed_onboarding",
];

let userColumnStatePromise = null;

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toNullableNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function fallbackEmailForClerkId(clerkId) {
  return `${clerkId}@quickhands.local`;
}

async function getUserColumnState() {
  if (!userColumnStatePromise) {
    userColumnStatePromise = sql
      .query(
        `
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'users'
            AND column_name = ANY($1);
        `,
        [USER_OPTIONAL_COLUMNS]
      )
      .then((rows) => {
        const availableColumns = new Set(rows.map((row) => row.column_name));
        return {
          email: availableColumns.has("email"),
          fullName: availableColumns.has("full_name"),
          imageUrl: availableColumns.has("image_url"),
          skills: availableColumns.has("skills"),
          metadata: availableColumns.has("metadata"),
          name: availableColumns.has("name"),
          experienceLevel: availableColumns.has("experience_level"),
          hourlyRate: availableColumns.has("hourly_rate"),
          completedOnboarding: availableColumns.has("completed_onboarding"),
        };
      });
  }

  return userColumnStatePromise;
}

async function getUserRowByClerkId(clerkId) {
  const result = await sql.query(
    `
      SELECT *
      FROM users
      WHERE clerk_id = $1
      LIMIT 1;
    `,
    [clerkId]
  );

  return result[0] || null;
}

function mergeProfileMetadata(metadata, payload = {}) {
  const currentMetadata = asObject(metadata);
  const currentProfile = asObject(currentMetadata.profile);
  const nextProfile = { ...currentProfile };

  if (payload.name !== undefined) {
    nextProfile.name = payload.name || null;
  }
  if (payload.email !== undefined) {
    nextProfile.email = payload.email || null;
  }
  if (payload.imageUrl !== undefined) {
    nextProfile.imageUrl = payload.imageUrl || null;
  }
  if (payload.skills !== undefined) {
    nextProfile.skills = payload.skills || null;
  }
  if (payload.experienceLevel !== undefined) {
    nextProfile.experienceLevel = payload.experienceLevel || null;
  }
  if (payload.hourlyRate !== undefined) {
    nextProfile.hourlyRate = payload.hourlyRate ?? null;
  }
  if (payload.completedOnboarding !== undefined) {
    nextProfile.completedOnboarding = payload.completedOnboarding === true;
  }

  return {
    ...currentMetadata,
    profile: nextProfile,
  };
}

export function buildReviewSummaryFromMetadata(metadata) {
  const reviews = [...(Array.isArray(asObject(metadata).receivedReviews) ? asObject(metadata).receivedReviews : [])]
    .filter((review) => Number.isFinite(Number(review?.rating)))
    .sort(
      (left, right) =>
        new Date(right?.createdAt || 0).getTime() - new Date(left?.createdAt || 0).getTime()
    );

  if (reviews.length === 0) {
    return {
      averageRating: 0,
      reviewCount: 0,
      latestReview: null,
    };
  }

  const total = reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0);
  const averageRating = Number((total / reviews.length).toFixed(1));
  const latestReview = reviews[0];

  return {
    averageRating,
    reviewCount: reviews.length,
    latestReview: latestReview
      ? {
          rating: Number(latestReview.rating || 0),
          comment: asTrimmedString(latestReview.comment) || null,
          reviewerName: asTrimmedString(latestReview.reviewerName) || "User",
          createdAt: latestReview.createdAt || null,
        }
      : null,
  };
}

function transformUser(user) {
  const metadata = asObject(user.metadata);
  const profile = asObject(metadata.profile);
  const location = normalizeLocationPayload(metadata.location || {});
  const hasLocation =
    location.label ||
    location.city ||
    location.latitude !== null ||
    location.longitude !== null;

  return {
    id: user.id,
    clerkId: user.clerk_id,
    name:
      user.name ||
      user.full_name ||
      profile.name ||
      profile.fullName ||
      user.email ||
      null,
    email: user.email || profile.email || null,
    imageUrl: user.image_url || profile.imageUrl || null,
    skills: user.skills ?? profile.skills ?? null,
    experienceLevel: user.experience_level ?? profile.experienceLevel ?? null,
    hourlyRate: toNullableNumber(user.hourly_rate ?? profile.hourlyRate),
    completedOnboarding:
      user.completed_onboarding === true || profile.completedOnboarding === true,
    location: hasLocation ? location : null,
    reviewSummary: buildReviewSummaryFromMetadata(metadata),
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

function buildUserMutation({
  columnState,
  currentRow = null,
  clerkId,
  name,
  email,
  imageUrl,
  skills,
  experienceLevel,
  hourlyRate,
  completedOnboarding,
}) {
  const existingMetadata = asObject(currentRow?.metadata);
  const nextMetadata = columnState.metadata
    ? mergeProfileMetadata(existingMetadata, {
        name,
        email,
        imageUrl,
        skills,
        experienceLevel,
        hourlyRate,
        completedOnboarding,
      })
    : null;

  const normalizedName = asTrimmedString(name) || null;
  const normalizedEmail = asTrimmedString(email) || null;
  const normalizedImageUrl = asTrimmedString(imageUrl) || null;
  const normalizedSkills = asTrimmedString(skills) || null;
  const normalizedExperience = asTrimmedString(experienceLevel) || null;
  const normalizedHourlyRate = toNullableNumber(hourlyRate);
  const normalizedCompleted = completedOnboarding === true;

  const columns = ["clerk_id"];
  const values = [clerkId];

  if (columnState.email) {
    columns.push("email");
    values.push(normalizedEmail || currentRow?.email || fallbackEmailForClerkId(clerkId));
  }
  if (columnState.fullName) {
    columns.push("full_name");
    values.push(normalizedName || currentRow?.full_name || null);
  }
  if (columnState.imageUrl) {
    columns.push("image_url");
    values.push(normalizedImageUrl ?? currentRow?.image_url ?? null);
  }
  if (columnState.skills) {
    columns.push("skills");
    values.push(normalizedSkills ?? currentRow?.skills ?? null);
  }
  if (columnState.name) {
    columns.push("name");
    values.push(normalizedName || currentRow?.name || currentRow?.full_name || null);
  }
  if (columnState.experienceLevel) {
    columns.push("experience_level");
    values.push(normalizedExperience ?? currentRow?.experience_level ?? null);
  }
  if (columnState.hourlyRate) {
    columns.push("hourly_rate");
    values.push(normalizedHourlyRate ?? currentRow?.hourly_rate ?? null);
  }
  if (columnState.completedOnboarding) {
    columns.push("completed_onboarding");
    values.push(
      completedOnboarding === undefined
        ? currentRow?.completed_onboarding === true
        : normalizedCompleted
    );
  }
  if (columnState.metadata) {
    columns.push("metadata");
    values.push(nextMetadata);
  }

  return {
    columns,
    values,
  };
}

export async function upsertUser(userData) {
  const {
    clerkId,
    name,
    email,
    imageUrl,
    skills,
    experienceLevel,
    hourlyRate,
    completedOnboarding = false,
  } = userData;

  try {
    const columnState = await getUserColumnState();
    const currentRow = await getUserRowByClerkId(clerkId);
    const mutation = buildUserMutation({
      columnState,
      currentRow,
      clerkId,
      name,
      email,
      imageUrl,
      skills,
      experienceLevel,
      hourlyRate,
      completedOnboarding,
    });

    let result;

    if (!currentRow) {
      const columns = [...mutation.columns, "created_at", "updated_at"];
      const values = [...mutation.values];
      const placeholders = columns.map((_, index) => `$${index + 1}`);

      values.push(new Date().toISOString());
      values.push(new Date().toISOString());

      result = await sql.query(
        `
          INSERT INTO users (${columns.join(", ")})
          VALUES (${placeholders.join(", ")})
          RETURNING *;
        `,
        values
      );
    } else {
      const assignments = [];
      const values = [];

      mutation.columns.forEach((column, index) => {
        if (column === "clerk_id") {
          return;
        }

        values.push(mutation.values[index]);
        assignments.push(`${column} = $${values.length}`);
      });

      values.push(clerkId);

      result = await sql.query(
        `
          UPDATE users
          SET ${assignments.join(", ")}, updated_at = NOW()
          WHERE clerk_id = $${values.length}
          RETURNING *;
        `,
        values
      );
    }

    if (!result?.length) {
      throw new Error("No user returned from user save operation");
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
    const row = await getUserRowByClerkId(clerkId);

    if (!row) {
      return null;
    }

    logger.info(`User found: clerk_id=${clerkId}`);
    return transformUser(row);
  } catch (error) {
    logger.error(`Database error getting user by clerk_id=${clerkId}:`, error);
    throw new Error("Failed to retrieve user from database");
  }
}

export async function getUserMetadataByClerkId(clerkId) {
  const row = await getUserRowByClerkId(clerkId);
  return asObject(row?.metadata);
}

export async function patchUserMetadataByClerkId(clerkId, updater) {
  const columnState = await getUserColumnState();

  if (!columnState.metadata) {
    throw new Error("User metadata is not available in this database");
  }

  let row = await getUserRowByClerkId(clerkId);
  if (!row) {
    await upsertUser({ clerkId });
    row = await getUserRowByClerkId(clerkId);
  }

  const currentMetadata = asObject(row?.metadata);
  const nextMetadata = asObject(
    typeof updater === "function" ? updater(currentMetadata) : currentMetadata
  );

  const updated = await sql.query(
    `
      UPDATE users
      SET metadata = $1, updated_at = NOW()
      WHERE clerk_id = $2
      RETURNING *;
    `,
    [nextMetadata, clerkId]
  );

  if (!updated?.length) {
    throw new Error("Failed to update user metadata");
  }

  return transformUser(updated[0]);
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
    const updatedUser = await patchUserMetadataByClerkId(clerkId, (metadata) => ({
      ...metadata,
      location: normalizedLocation,
    }));

    return updatedUser;
  } catch (error) {
    logger.error(`updateUserLocationByClerkId error for ${clerkId}:`, error);
    throw error;
  }
}

function mapChatUserRow(row) {
  const metadata = asObject(row.metadata);
  const profile = asObject(metadata.profile);

  return {
    clerkId: row.clerk_id,
    displayName:
      row.full_name || row.name || profile.name || row.email || profile.email || "User",
    email: row.email || profile.email || null,
    imageUrl: row.image_url || profile.imageUrl || null,
    skills: row.skills || profile.skills || null,
    location: normalizeLocationPayload(metadata.location || {}),
    reviewSummary: buildReviewSummaryFromMetadata(metadata),
  };
}

export async function listUsersForChat(excludeClerkId, opts = {}) {
  const limit = Math.min(100, Math.max(1, Number(opts.limit) || 50));
  const q = asTrimmedString(opts.q).toLowerCase();

  try {
    const result = await sql.query(
      `
        SELECT *
        FROM users
        WHERE clerk_id != $1
        ORDER BY updated_at DESC
        LIMIT $2;
      `,
      [excludeClerkId, Math.max(limit * 3, limit)]
    );

    const mapped = result.map(mapChatUserRow);
    const filtered = q
      ? mapped.filter((row) => {
          const haystacks = [
            row.displayName,
            row.email,
            row.skills,
            row.location?.label,
            row.location?.city,
          ]
            .filter(Boolean)
            .map((entry) => String(entry).toLowerCase());

          return haystacks.some((entry) => entry.includes(q));
        })
      : mapped;

    return filtered.slice(0, limit);
  } catch (error) {
    logger.error("listUsersForChat error:", error);
    throw new Error("Failed to list users");
  }
}

export async function getUserChatSummary(clerkId) {
  try {
    const row = await getUserRowByClerkId(clerkId);
    if (!row) {
      return null;
    }
    return mapChatUserRow(row);
  } catch (error) {
    logger.error(`getUserChatSummary error for ${clerkId}:`, error);
    throw new Error("Failed to load user");
  }
}

export async function getUsersByClerkIds(clerkIds) {
  const normalizedClerkIds = [...new Set(clerkIds.map(asTrimmedString).filter(Boolean))];
  if (normalizedClerkIds.length === 0) {
    return [];
  }

  const rows = await sql.query(
    `
      SELECT *
      FROM users
      WHERE clerk_id = ANY($1);
    `,
    [normalizedClerkIds]
  );

  return rows;
}

export async function getReviewSummariesByClerkIds(clerkIds) {
  const rows = await getUsersByClerkIds(clerkIds);
  const summaries = new Map();

  rows.forEach((row) => {
    summaries.set(row.clerk_id, buildReviewSummaryFromMetadata(row.metadata));
  });

  return summaries;
}

export async function getReviewSummaryByClerkId(clerkId) {
  const row = await getUserRowByClerkId(clerkId);
  return row ? buildReviewSummaryFromMetadata(row.metadata) : buildReviewSummaryFromMetadata({});
}
