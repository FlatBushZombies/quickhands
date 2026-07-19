import { randomUUID } from "node:crypto";
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

function normalizePushToken(pushToken) {
  const normalizedToken = asTrimmedString(pushToken);
  if (
    !normalizedToken ||
    (!normalizedToken.startsWith("ExpoPushToken[") &&
      !normalizedToken.startsWith("ExponentPushToken["))
  ) {
    return null;
  }

  return normalizedToken;
}

function buildPushTokenEntry(entry) {
  if (typeof entry === "string") {
    const token = normalizePushToken(entry);
    return token
      ? {
          token,
          platform: null,
          updatedAt: null,
        }
      : null;
  }

  const token = normalizePushToken(entry?.token);
  if (!token) {
    return null;
  }

  return {
    token,
    platform: asTrimmedString(entry?.platform) || null,
    updatedAt: entry?.updatedAt || null,
  };
}

function getStoredPushTokens(metadata) {
  const notifications = asObject(asObject(metadata).notifications);
  const tokens = Array.isArray(notifications.pushTokens)
    ? notifications.pushTokens
    : [];

  return tokens
    .map(buildPushTokenEntry)
    .filter(Boolean);
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

/**
 * Long-lived opaque token used only to authenticate background location
 * pings (see #services/proximity.service.js) — separate from Clerk auth
 * because background tasks have no React tree and can't refresh a short
 * lived Clerk session JWT. Mirrors how Expo push tokens are stored, just
 * for a different low-sensitivity purpose (posting a lat/long).
 */
export async function getOrCreateDeviceLocationToken(clerkId) {
  const metadata = await getUserMetadataByClerkId(clerkId);
  if (typeof metadata.deviceLocationToken === "string" && metadata.deviceLocationToken) {
    return metadata.deviceLocationToken;
  }

  const token = randomUUID();
  await patchUserMetadataByClerkId(clerkId, (current) => ({
    ...current,
    deviceLocationToken: token,
  }));

  return token;
}

export async function getClerkIdByDeviceLocationToken(token) {
  const normalizedToken = typeof token === "string" ? token.trim() : "";
  if (!normalizedToken) {
    return null;
  }

  const result = await sql.query(
    `
      SELECT clerk_id
      FROM users
      WHERE metadata->>'deviceLocationToken' = $1
      LIMIT 1;
    `,
    [normalizedToken]
  );

  return result[0]?.clerk_id || null;
}

export async function listPushTokensByClerkId(clerkId) {
  const metadata = await getUserMetadataByClerkId(clerkId);
  return getStoredPushTokens(metadata);
}

export async function registerPushTokenByClerkId(clerkId, pushToken, platform, appRole) {
  const normalizedToken = normalizePushToken(pushToken);

  if (!normalizedToken) {
    throw new Error("A valid Expo push token is required");
  }

  const normalizedAppRole = asTrimmedString(appRole);

  return patchUserMetadataByClerkId(clerkId, (metadata) => {
    const notifications = asObject(metadata.notifications);
    const existingTokens = getStoredPushTokens(metadata).filter(
      (entry) => entry.token !== normalizedToken
    );

    return {
      ...metadata,
      // Tags which app this profile belongs to (freelance-app vs
      // client-app share the same users table) so job-match notifications
      // can be scoped to freelancers only. Set on every push-token
      // registration, which runs on every signed-in app open.
      ...(normalizedAppRole ? { appRole: normalizedAppRole } : {}),
      notifications: {
        ...notifications,
        pushTokens: [
          {
            token: normalizedToken,
            platform: asTrimmedString(platform) || null,
            updatedAt: new Date().toISOString(),
          },
          ...existingTokens,
        ].slice(0, 5),
      },
    };
  });
}

export async function unregisterPushTokenByClerkId(clerkId, pushToken) {
  const normalizedToken = normalizePushToken(pushToken);

  if (!normalizedToken) {
    return patchUserMetadataByClerkId(clerkId, (metadata) => metadata);
  }

  return patchUserMetadataByClerkId(clerkId, (metadata) => {
    const notifications = asObject(metadata.notifications);
    const remainingTokens = getStoredPushTokens(metadata).filter(
      (entry) => entry.token !== normalizedToken
    );

    return {
      ...metadata,
      notifications: {
        ...notifications,
        pushTokens: remainingTokens,
      },
    };
  });
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

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asArrayOfStrings(value) {
  return asArray(value).filter((entry) => typeof entry === "string" && entry);
}

// ─── Favorites (clients saving freelancers to rehire later) ────────────────
// Stored on the CLIENT's own metadata as a list of freelancer clerkIds —
// same schema-light approach as reviews/push tokens, no migration needed.

export async function addFavoriteFreelancer(clientClerkId, freelancerClerkId) {
  const normalized = asTrimmedString(freelancerClerkId);
  if (!normalized) {
    throw new Error("freelancerClerkId is required");
  }
  if (normalized === clientClerkId) {
    throw new Error("Cannot favorite yourself");
  }

  return patchUserMetadataByClerkId(clientClerkId, (metadata) => {
    const existing = asArrayOfStrings(metadata.favoriteFreelancerIds);
    if (existing.includes(normalized)) {
      return metadata;
    }

    return {
      ...metadata,
      favoriteFreelancerIds: [normalized, ...existing].slice(0, 200),
    };
  });
}

export async function removeFavoriteFreelancer(clientClerkId, freelancerClerkId) {
  const normalized = asTrimmedString(freelancerClerkId);

  return patchUserMetadataByClerkId(clientClerkId, (metadata) => ({
    ...metadata,
    favoriteFreelancerIds: asArrayOfStrings(metadata.favoriteFreelancerIds).filter(
      (id) => id !== normalized
    ),
  }));
}

export async function listFavoriteFreelancers(clientClerkId) {
  const metadata = await getUserMetadataByClerkId(clientClerkId);
  const ids = asArrayOfStrings(metadata.favoriteFreelancerIds);
  if (ids.length === 0) {
    return [];
  }

  const rows = await getUsersByClerkIds(ids);
  const byId = new Map(rows.map((row) => [row.clerk_id, mapChatUserRow(row)]));

  // Preserve favorited order (most-recently-added first); silently drop
  // any freelancer whose account no longer exists.
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

// ─── Saved search alerts (clients get notified when a matching freelancer
// completes onboarding) ──────────────────────────────────────────────────

function normalizeSavedSearch(input) {
  const category = asTrimmedString(input?.category);
  if (!category) {
    throw new Error("category is required");
  }

  const minBudget = toNullableNumber(input?.minBudget);
  const maxBudget = toNullableNumber(input?.maxBudget);

  return {
    id: asTrimmedString(input?.id) || randomUUID(),
    category,
    minBudget,
    maxBudget,
    createdAt: input?.createdAt || new Date().toISOString(),
  };
}

export async function addSavedSearch(clientClerkId, input) {
  const nextSearch = normalizeSavedSearch(input);

  await patchUserMetadataByClerkId(clientClerkId, (metadata) => ({
    ...metadata,
    savedSearches: [nextSearch, ...asArray(metadata.savedSearches).slice(0, 19)],
  }));

  return nextSearch;
}

export async function removeSavedSearch(clientClerkId, savedSearchId) {
  return patchUserMetadataByClerkId(clientClerkId, (metadata) => ({
    ...metadata,
    savedSearches: asArray(metadata.savedSearches).filter(
      (entry) => entry?.id !== savedSearchId
    ),
  }));
}

export async function listSavedSearches(clientClerkId) {
  const metadata = await getUserMetadataByClerkId(clientClerkId);
  return asArray(metadata.savedSearches);
}

/**
 * Finds every client whose saved search matches a freelancer who just
 * became available (completed onboarding), and returns the clerkIds to
 * notify. Mirrors findUsersMatchingJob's approach but in the other
 * direction — freelancer-to-client instead of job-to-freelancer.
 */
export async function findClientsMatchingFreelancer({ skills, hourlyRate }) {
  const normalizedSkills = asTrimmedString(skills).toLowerCase();
  const normalizedRate = toNullableNumber(hourlyRate);

  const rows = await sql.query(
    `
      SELECT clerk_id, metadata
      FROM users
      WHERE metadata->>'appRole' = 'client'
        AND jsonb_array_length(COALESCE(metadata->'savedSearches', '[]'::jsonb)) > 0;
    `
  );

  const matchedClerkIds = [];

  for (const row of rows) {
    const savedSearches = asArray(row.metadata?.savedSearches);
    const hasMatch = savedSearches.some((search) => {
      const category = asTrimmedString(search?.category).toLowerCase();
      if (!category || !normalizedSkills.includes(category)) {
        return false;
      }

      const min = toNullableNumber(search?.minBudget);
      const max = toNullableNumber(search?.maxBudget);
      if (normalizedRate === null) {
        return true;
      }
      if (min !== null && normalizedRate < min) {
        return false;
      }
      if (max !== null && normalizedRate > max) {
        return false;
      }

      return true;
    });

    if (hasMatch) {
      matchedClerkIds.push(row.clerk_id);
    }
  }

  return matchedClerkIds;
}

// ─── Client analytics ────────────────────────────────────────────────────

// Quotations are free text (e.g. "150/hour", "2,500 total") since there's
// no payment processing to source a real number from — this is a
// best-effort estimate, pulling the first numeric run out of the string.
function parseQuotationAmount(quotation) {
  if (typeof quotation !== "string") {
    return null;
  }
  const match = quotation.replace(/,/g, "").match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

export async function getClientAnalytics(clientClerkId) {
  const [jobsResult, acceptedQuotationsResult, responseTimeResult] = await Promise.all([
    sql.query(
      `SELECT COUNT(*) AS total FROM service_request WHERE clerk_id = $1;`,
      [clientClerkId]
    ),
    sql.query(
      `
        SELECT a.quotation, a.status
        FROM job_applications a
        JOIN service_request sr ON sr.id = a.job_id
        WHERE sr.clerk_id = $1
          AND a.status IN ('accepted', 'completed');
      `,
      [clientClerkId]
    ),
    sql.query(
      `
        SELECT AVG(EXTRACT(EPOCH FROM (first_app.first_created_at - sr.created_at))) AS avg_seconds
        FROM service_request sr
        JOIN LATERAL (
          SELECT MIN(a.created_at) AS first_created_at
          FROM job_applications a
          WHERE a.job_id = sr.id
        ) first_app ON first_app.first_created_at IS NOT NULL
        WHERE sr.clerk_id = $1;
      `,
      [clientClerkId]
    ),
  ]);

  const totalJobsPosted = Number(jobsResult[0]?.total) || 0;

  let totalCommittedSpend = 0;
  let completedJobsCount = 0;
  for (const row of acceptedQuotationsResult) {
    const amount = parseQuotationAmount(row.quotation);
    if (amount !== null) {
      totalCommittedSpend += amount;
    }
    if (row.status === "completed") {
      completedJobsCount += 1;
    }
  }

  const avgSeconds = Number(responseTimeResult[0]?.avg_seconds);
  const averageResponseTimeHours = Number.isFinite(avgSeconds) && avgSeconds > 0
    ? Math.round((avgSeconds / 3600) * 10) / 10
    : null;

  return {
    totalJobsPosted,
    completedJobsCount,
    totalCommittedSpend: Math.round(totalCommittedSpend * 100) / 100,
    averageResponseTimeHours,
  };
}
