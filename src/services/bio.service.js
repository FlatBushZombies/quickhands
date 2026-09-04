import logger from "#config/logger.js";
import { sql } from "#config/database.js";
import {
  buildReviewSummaryFromMetadata,
  getUserByClerkId,
  getUserMetadataByClerkId,
  patchUserMetadataByClerkId,
} from "#services/user.service.js";
import { getPortfolioForSpecialist } from "#services/portfolio.service.js";
import { listReceivedReviews } from "#services/reviews.service.js";
import { normalizeLocationPayload } from "#utils/location.js";

// Link-in-bio settings live entirely under metadata.linkBio — same
// schema-light approach as favorites/savedSearches in user.service.js, so
// this ships without a migration. Uniqueness is checked with a metadata
// jsonb-path scan (no index) — identical trade-off to how
// deviceLocationToken lookups already work in user.service.js, fine at
// this table size; add a functional index if the users table grows large
// enough for it to matter.

const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/;

// Routes/words this could collide with on quickhands-web, or that would be
// confusing/impersonation-prone as a public handle.
const RESERVED_USERNAMES = new Set([
  "admin", "api", "app", "about", "bio", "blog", "dashboard", "download",
  "feedback", "help", "home", "login", "logout", "me", "privacy-policy",
  "professionals", "profile", "quickhands", "settings", "signin", "signup",
  "support", "terms", "www",
]);

const MAX_CUSTOM_LINKS = 8;
const MAX_TAGLINE_LENGTH = 140;
const MAX_LINK_LABEL_LENGTH = 40;

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeUsername(input) {
  return asTrimmedString(input).toLowerCase();
}

export function validateUsernameFormat(username) {
  if (!username) {
    return "Username is required";
  }
  if (!USERNAME_PATTERN.test(username)) {
    return "Use 3-30 characters: lowercase letters, numbers, and hyphens only (can't start or end with a hyphen)";
  }
  if (RESERVED_USERNAMES.has(username)) {
    return "That username is reserved, please choose another";
  }
  return null;
}

export async function isUsernameTaken(username, excludeClerkId = null) {
  const rows = await sql.query(
    `
      SELECT clerk_id
      FROM users
      WHERE LOWER(metadata->'linkBio'->>'username') = $1
        AND ($2::text IS NULL OR clerk_id != $2)
      LIMIT 1;
    `,
    [username, excludeClerkId]
  );

  return rows.length > 0;
}

function sanitizeCustomLinks(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .slice(0, MAX_CUSTOM_LINKS)
    .map((entry) => {
      const label = asTrimmedString(entry?.label).slice(0, MAX_LINK_LABEL_LENGTH);
      let url = asTrimmedString(entry?.url);

      if (!label || !url) {
        return null;
      }

      // Be forgiving about a bare "example.com" — Linktree-style link
      // builders don't require the visitor to type a scheme.
      if (!/^https?:\/\//i.test(url) && !/^(mailto|tel):/i.test(url)) {
        url = `https://${url}`;
      }

      try {
        // Throws on genuinely malformed input; mailto:/tel: parse fine too.
        // eslint-disable-next-line no-new
        new URL(url);
      } catch {
        return null;
      }

      return { label, url };
    })
    .filter(Boolean);
}

// No column anywhere in this schema captures a specialist's phone number
// (the mobile onboarding flow never collects one) — it only ever shows up
// as contact info a CLIENT shares after accepting an application. "Call
// me" / "WhatsApp" on the bio page need their own number, so it lives
// here, entered directly by the specialist for this public page.
function sanitizePhone(input) {
  const raw = asTrimmedString(input);
  if (!raw) {
    return null;
  }
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.replace(/\D/g, "").length < 7 || digits.length > 20) {
    return null;
  }
  return digits;
}

function sanitizeSmartLinks(input) {
  const defaults = { portfolio: true, hireMe: true, call: true, whatsapp: true, email: true };
  const source = asObject(input);
  const result = {};
  for (const key of Object.keys(defaults)) {
    result[key] = source[key] === undefined ? defaults[key] : source[key] === true;
  }
  return result;
}

function suggestUsernameFromName(name) {
  const base = asTrimmedString(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);

  return base || "specialist";
}

/**
 * Current bio settings for the editor UI, plus the real profile fields the
 * editor needs to render a live preview (name, avatar, skills, rating) and
 * a suggested username if one hasn't been picked yet.
 */
export async function getBioSettingsForClerkId(clerkId) {
  const [user, metadata] = await Promise.all([
    getUserByClerkId(clerkId),
    getUserMetadataByClerkId(clerkId),
  ]);
  if (!user) {
    throw new Error("User not found");
  }

  const linkBio = asObject(metadata.linkBio);

  return {
    username: linkBio.username || null,
    suggestedUsername: linkBio.username || suggestUsernameFromName(user.name),
    tagline: linkBio.tagline || "",
    phone: linkBio.phone || "",
    smartLinks: sanitizeSmartLinks(linkBio.smartLinks),
    customLinks: sanitizeCustomLinks(linkBio.customLinks),
    isPublished: Boolean(linkBio.username),
    profile: {
      name: user.name,
      imageUrl: user.imageUrl,
      skills: user.skills,
      experienceLevel: user.experienceLevel,
      hourlyRate: user.hourlyRate,
      reviewSummary: user.reviewSummary,
    },
  };
}

export async function updateBioSettings(clerkId, payload) {
  const nextUsername =
    payload.username === undefined ? undefined : normalizeUsername(payload.username);

  if (nextUsername !== undefined) {
    const formatError = validateUsernameFormat(nextUsername);
    if (formatError) {
      throw new Error(formatError);
    }
    if (await isUsernameTaken(nextUsername, clerkId)) {
      throw new Error("That username is already taken");
    }
  }

  const nextTagline =
    payload.tagline === undefined
      ? undefined
      : asTrimmedString(payload.tagline).slice(0, MAX_TAGLINE_LENGTH);

  const nextPhone = payload.phone === undefined ? undefined : sanitizePhone(payload.phone);

  const nextSmartLinks =
    payload.smartLinks === undefined ? undefined : sanitizeSmartLinks(payload.smartLinks);

  const nextCustomLinks =
    payload.customLinks === undefined ? undefined : sanitizeCustomLinks(payload.customLinks);

  await patchUserMetadataByClerkId(clerkId, (metadata) => {
    const currentLinkBio = asObject(metadata.linkBio);
    return {
      ...metadata,
      linkBio: {
        ...currentLinkBio,
        ...(nextUsername !== undefined ? { username: nextUsername } : {}),
        ...(nextTagline !== undefined ? { tagline: nextTagline } : {}),
        ...(nextPhone !== undefined ? { phone: nextPhone } : {}),
        ...(nextSmartLinks !== undefined ? { smartLinks: nextSmartLinks } : {}),
        ...(nextCustomLinks !== undefined ? { customLinks: nextCustomLinks } : {}),
      },
    };
  });

  return getBioSettingsForClerkId(clerkId);
}

async function getCompletedJobsCount(clerkId) {
  const rows = await sql.query(
    `
      SELECT COUNT(*)::int AS count
      FROM job_applications
      WHERE freelancer_clerk_id = $1
        AND status = 'completed';
    `,
    [clerkId]
  );
  return rows[0]?.count || 0;
}

/**
 * Public payload for the quickhands-web bio page — no auth, so only
 * fields already meant to be public-facing (same data the in-app
 * portfolio view shows) are included.
 */
export async function getPublicBioProfile(username) {
  const normalized = normalizeUsername(username);
  if (!normalized) {
    return null;
  }

  const rows = await sql.query(
    `
      SELECT *
      FROM users
      WHERE LOWER(metadata->'linkBio'->>'username') = $1
      LIMIT 1;
    `,
    [normalized]
  );

  const row = rows[0];
  if (!row) {
    return null;
  }

  const metadata = asObject(row.metadata);
  const linkBio = asObject(metadata.linkBio);
  const profile = asObject(metadata.profile);
  const clerkId = row.clerk_id;
  const phone = linkBio.phone || null;
  const email = row.email || profile.email || null;
  const smartLinks = sanitizeSmartLinks(linkBio.smartLinks);
  // Toggles are stored independently of whether a phone/email was ever
  // captured — enforce it here so a stale "on" can never render a dead
  // tel:/wa.me/mailto: link.
  smartLinks.call = smartLinks.call && Boolean(phone);
  smartLinks.whatsapp = smartLinks.whatsapp && Boolean(phone);
  smartLinks.email = smartLinks.email && Boolean(email);

  const [portfolio, completedJobsCount, testimonials] = await Promise.all([
    getPortfolioForSpecialist(clerkId).catch((error) => {
      logger.warn("getPublicBioProfile: portfolio lookup failed", { clerkId, message: error.message });
      return { projects: [] };
    }),
    getCompletedJobsCount(clerkId).catch(() => 0),
    // Same shape/limit as getSpecialistPortfolioController's in-app
    // testimonials list, so the public page shows exactly what the mobile
    // portfolio preview already shows.
    listReceivedReviews(clerkId)
      .then(({ reviews }) =>
        reviews
          .filter((review) => review.comment)
          .slice(0, 5)
          .map((review) => ({
            reviewerName: review.reviewerName,
            rating: review.rating,
            comment: review.comment,
            createdAt: review.createdAt,
          }))
      )
      .catch((error) => {
        logger.warn("getPublicBioProfile: testimonials lookup failed", { clerkId, message: error.message });
        return [];
      }),
  ]);

  const location = normalizeLocationPayload(metadata.location || {});
  const hasLocation = Boolean(location.label || location.city);

  return {
    username: linkBio.username,
    name: row.name || row.full_name || profile.name || "Quickhands Specialist",
    imageUrl: row.image_url || profile.imageUrl || null,
    skills: row.skills || profile.skills || null,
    experienceLevel: row.experience_level || profile.experienceLevel || null,
    hourlyRate: row.hourly_rate ?? profile.hourlyRate ?? null,
    location: hasLocation ? { label: location.label, city: location.city } : null,
    tagline: linkBio.tagline || "",
    phone,
    email,
    smartLinks,
    customLinks: sanitizeCustomLinks(linkBio.customLinks),
    reviewSummary: buildReviewSummaryFromMetadata(metadata),
    testimonials,
    completedJobsCount,
    projects: portfolio.projects.slice(0, 6),
    memberSince: row.created_at,
  };
}
