import { randomUUID } from "node:crypto";
import {
  getUserMetadataByClerkId,
  patchUserMetadataByClerkId,
} from "#services/user.service.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTemplatePayload(payload = {}) {
  return {
    id: asTrimmedString(payload.id) || randomUUID(),
    name:
      asTrimmedString(payload.name) ||
      asTrimmedString(payload.serviceType) ||
      "Saved template",
    serviceType: asTrimmedString(payload.serviceType) || "",
    selectedServices: asArray(payload.selectedServices).filter(Boolean),
    startDate: asTrimmedString(payload.startDate) || "",
    endDate: asTrimmedString(payload.endDate) || "",
    maxPrice: Number(payload.maxPrice) || 0,
    specialistChoice: asTrimmedString(payload.specialistChoice) || "",
    additionalInfo: asTrimmedString(payload.additionalInfo) || "",
    documents: asArray(payload.documents).filter(Boolean),
    createdAt: payload.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function listJobTemplates(clerkId) {
  const metadata = await getUserMetadataByClerkId(clerkId);
  return asArray(metadata.jobTemplates)
    .map(normalizeTemplatePayload)
    .sort(
      (left, right) =>
        new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    );
}

export async function saveJobTemplate(clerkId, payload) {
  const template = normalizeTemplatePayload(payload);

  await patchUserMetadataByClerkId(clerkId, (metadata) => {
    const currentTemplates = asArray(metadata.jobTemplates)
      .map(normalizeTemplatePayload)
      .filter((entry) => entry.id !== template.id);

    return {
      ...metadata,
      jobTemplates: [template, ...currentTemplates].slice(0, 20),
    };
  });

  return template;
}

export async function deleteJobTemplate(clerkId, templateId) {
  let deleted = false;

  await patchUserMetadataByClerkId(clerkId, (metadata) => {
    const currentTemplates = asArray(metadata.jobTemplates).map(normalizeTemplatePayload);
    const nextTemplates = currentTemplates.filter((entry) => entry.id !== templateId);
    deleted = nextTemplates.length !== currentTemplates.length;

    return {
      ...metadata,
      jobTemplates: nextTemplates,
    };
  });

  return deleted;
}
