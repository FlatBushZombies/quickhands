export const COMMUNICATION_CARD_PREFIX = "QH_CARD::";
export const COMMUNICATION_TAGS = {
  freelancer: [
    { kind: "available-now", label: "Available now" },
    { kind: "need-address", label: "Need address" },
    { kind: "need-photos", label: "Need photos" },
    { kind: "running-late", label: "Running late" },
    { kind: "job-complete", label: "Job complete" },
  ],
  client: [
    { kind: "ready-for-visit", label: "Ready for visit" },
    { kind: "please-call", label: "Please call" },
    { kind: "share-location", label: "Location shared" },
    { kind: "need-quote-update", label: "Need quote update" },
    { kind: "confirm-arrival", label: "Confirm arrival" },
  ],
};

function trimOptionalString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function findTagByKind(kind) {
  const normalizedKind = trimOptionalString(kind);
  return [...COMMUNICATION_TAGS.freelancer, ...COMMUNICATION_TAGS.client].find(
    (entry) => entry.kind === normalizedKind
  );
}

export function parseCommunicationCardText(text) {
  const rawText = trimOptionalString(text);

  if (!rawText.startsWith(COMMUNICATION_CARD_PREFIX)) {
    return null;
  }

  const payload = rawText.slice(COMMUNICATION_CARD_PREFIX.length);

  try {
    const parsed = JSON.parse(payload);
    const label = trimOptionalString(parsed?.label);
    const note = trimOptionalString(parsed?.note);
    const kind = trimOptionalString(parsed?.kind) || "update";

    if (!label) {
      return null;
    }

    return {
      kind,
      label,
      note: note || null,
    };
  } catch {
    return null;
  }
}

export function buildCommunicationCardText({ kind, note = null, label = null }) {
  const tag = findTagByKind(kind);
  const resolvedLabel = trimOptionalString(label) || tag?.label || null;

  if (!resolvedLabel) {
    throw new Error("A valid communication tag is required");
  }

  return `${COMMUNICATION_CARD_PREFIX}${JSON.stringify({
    kind: trimOptionalString(kind) || "update",
    label: resolvedLabel,
    note: trimOptionalString(note) || null,
  })}`;
}

export function buildCommunicationNotificationMessage({
  senderName,
  conversation,
  text,
}) {
  const parsedCard = parseCommunicationCardText(text);
  const displayName = trimOptionalString(senderName) || "Someone";
  const jobTitle = trimOptionalString(conversation?.jobTitle);

  if (parsedCard) {
    return `Status update: ${displayName} shared "${parsedCard.label}"${jobTitle ? ` for "${jobTitle}"` : ""}.`;
  }

  return `Status update: ${displayName} sent you a new note${jobTitle ? ` about "${jobTitle}"` : ""}.`;
}
