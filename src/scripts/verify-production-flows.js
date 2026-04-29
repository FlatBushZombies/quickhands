import assert from "node:assert/strict";
import {
  COMMUNICATION_CARD_PREFIX,
  buildCommunicationNotificationMessage,
  parseCommunicationCardText,
} from "#utils/communicationCards.js";
import {
  normalizeApplicationStatus,
  resolveApplicationContactPayload,
} from "#controllers/application.controller.js";

const sampleCard = `${COMMUNICATION_CARD_PREFIX}${JSON.stringify({
  kind: "available-now",
  label: "Available now",
  note: null,
})}`;

const parsedCard = parseCommunicationCardText(sampleCard);
assert(parsedCard, "communication card should parse");
assert.equal(parsedCard.kind, "available-now");
assert.equal(parsedCard.label, "Available now");
assert.equal(parsedCard.note, null);

const communicationNotification = buildCommunicationNotificationMessage({
  senderName: "Alex",
  conversation: { jobTitle: "Window cleaning" },
  text: sampleCard,
});
assert.equal(
  communicationNotification,
  'Status update: Alex shared "Available now" for "Window cleaning".'
);

assert.equal(normalizeApplicationStatus("accept"), "accepted");
assert.equal(normalizeApplicationStatus("approved"), "accepted");
assert.equal(normalizeApplicationStatus("reject"), "rejected");
assert.equal(normalizeApplicationStatus("declined"), "rejected");
assert.equal(normalizeApplicationStatus("unknown"), null);

const contactPayload = resolveApplicationContactPayload({
  phone: "0820001111",
  clientName: "Casey",
  notes: "Call after 5pm",
});
assert.deepEqual(contactPayload, {
  phoneNumber: "0820001111",
  contactName: "Casey",
  contactInstructions: "Call after 5pm",
});

console.log("production flow contract ok");
