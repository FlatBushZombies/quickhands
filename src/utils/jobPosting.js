/**
 * Validation for the fields the Post a task form sends. Pure functions so the
 * rules can be unit tested without a database or request.
 */

export const PREFERRED_TIMES = ["morning", "afternoon", "evening", "any"];

/** The design allows at most five task photos. */
export const MAX_JOB_DOCUMENTS = 5;

const PHOTO_HOST = "res.cloudinary.com";

/**
 * A missing budget is allowed and stored as NULL (the design has no budget
 * field). A provided value must be a finite, non-negative number.
 */
export function parseJobBudget(value) {
  if (value === undefined || value === null || value === "") {
    return { ok: true, value: null };
  }

  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, message: "maxPrice must be a valid non-negative number" };
  }

  return { ok: true, value: amount };
}

/** Morning / afternoon / evening / any, or nothing. */
export function parsePreferredTime(value) {
  if (value === undefined || value === null || value === "") {
    return { ok: true, value: null };
  }

  if (typeof value !== "string" || !PREFERRED_TIMES.includes(value)) {
    return {
      ok: false,
      message: `preferredTime must be one of: ${PREFERRED_TIMES.join(", ")}`,
    };
  }

  return { ok: true, value };
}

/**
 * Job photos are Cloudinary URLs from the upload step. Accepts an array or a
 * JSON-encoded array, capped at the design's photo limit.
 */
export function parseJobDocuments(value) {
  let list = value;
  if (typeof value === "string") {
    if (value.trim() === "") return { ok: true, value: [] };
    try {
      list = JSON.parse(value);
    } catch {
      return { ok: false, message: "documents must be a list of photo URLs" };
    }
  }

  if (list === undefined || list === null) return { ok: true, value: [] };
  if (!Array.isArray(list)) {
    return { ok: false, message: "documents must be a list of photo URLs" };
  }

  const urls = list.filter(Boolean);
  if (urls.length > MAX_JOB_DOCUMENTS) {
    return { ok: false, message: `A task can have at most ${MAX_JOB_DOCUMENTS} photos` };
  }

  for (const url of urls) {
    if (!isPhotoUrl(url)) {
      return { ok: false, message: "Each photo must be an uploaded image URL" };
    }
  }

  return { ok: true, value: urls.map(String) };
}

function isPhotoUrl(url) {
  if (typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === PHOTO_HOST;
  } catch {
    return false;
  }
}
