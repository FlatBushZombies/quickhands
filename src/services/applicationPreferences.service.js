import {
  getUserMetadataByClerkId,
  patchUserMetadataByClerkId,
} from "#services/user.service.js";

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeClientPreference(value) {
  const preference = asObject(value);
  return {
    shortlisted: preference.shortlisted === true,
    privateNote: asTrimmedString(preference.privateNote) || "",
    updatedAt: preference.updatedAt || null,
  };
}

export async function getClientApplicationPreferences(clerkId) {
  const metadata = await getUserMetadataByClerkId(clerkId);
  const rawPreferences = asObject(metadata.clientApplicationPreferences);
  const normalized = {};

  Object.entries(rawPreferences).forEach(([applicationId, preference]) => {
    normalized[String(applicationId)] = normalizeClientPreference(preference);
  });

  return normalized;
}

export async function saveClientApplicationPreference(clerkId, applicationId, updates = {}) {
  const key = String(applicationId);
  let nextPreference = null;

  await patchUserMetadataByClerkId(clerkId, (metadata) => {
    const currentPreferences = asObject(metadata.clientApplicationPreferences);
    const currentPreference = normalizeClientPreference(currentPreferences[key]);

    nextPreference = {
      shortlisted:
        updates.shortlisted === undefined
          ? currentPreference.shortlisted
          : updates.shortlisted === true,
      privateNote:
        updates.privateNote === undefined
          ? currentPreference.privateNote
          : asTrimmedString(updates.privateNote),
      updatedAt: new Date().toISOString(),
    };

    return {
      ...metadata,
      clientApplicationPreferences: {
        ...currentPreferences,
        [key]: nextPreference,
      },
    };
  });

  return nextPreference;
}
