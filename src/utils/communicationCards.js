export const COMMUNICATION_CARD_PREFIX = "QH_CARD::";

function trimOptionalString(value) {
  return typeof value === "string" ? value.trim() : "";
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

export function buildCommunicationNotificationMessage({
  senderName,
  conversation,
  text,
}) {
  const parsedCard = parseCommunicationCardText(text);
  const displayName = trimOptionalString(senderName) || "Someone";
  const jobTitle = trimOptionalString(conversation?.jobTitle);

  if (parsedCard) {
    return `Message update: ${displayName} shared "${parsedCard.label}"${jobTitle ? ` for "${jobTitle}"` : ""}.`;
  }

  return `Message update: ${displayName} sent you a new note${jobTitle ? ` about "${jobTitle}"` : ""}.`;
}
