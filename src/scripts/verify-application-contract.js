import assert from "node:assert/strict";

import {
  normalizeApplicationStatus,
  resolveApplicationContactPayload,
} from "../controllers/application.controller.js";
import { getAllApplications, getApplicationById } from "../services/application.service.js";

function verifyStatusAliases() {
  assert.equal(normalizeApplicationStatus("accepted"), "accepted");
  assert.equal(normalizeApplicationStatus("accept"), "accepted");
  assert.equal(normalizeApplicationStatus("approved"), "accepted");
  assert.equal(normalizeApplicationStatus("rejected"), "rejected");
  assert.equal(normalizeApplicationStatus("reject"), "rejected");
  assert.equal(normalizeApplicationStatus("declined"), "rejected");
  assert.equal(normalizeApplicationStatus("pending"), "pending");
  assert.equal(normalizeApplicationStatus("unknown"), null);
}

function verifyContactPayloadAliases() {
  assert.deepEqual(
    resolveApplicationContactPayload({
      clientPhoneNumber: " +27 82 123 4567 ",
      clientName: "Pat Client",
      contactReleaseNotes: "Call after 5pm",
    }),
    {
      phoneNumber: "+27 82 123 4567",
      contactName: "Pat Client",
      contactInstructions: "Call after 5pm",
    }
  );

  assert.deepEqual(
    resolveApplicationContactPayload({
      phone: "0712345678",
      contactPerson: "Alex",
      notes: "WhatsApp first",
    }),
    {
      phoneNumber: "0712345678",
      contactName: "Alex",
      contactInstructions: "WhatsApp first",
    }
  );
}

async function verifyApplicationResponseShape() {
  const applications = await getAllApplications();

  if (!applications.length) {
    console.log("No applications found in the database. Skipping response-shape verification.");
    return;
  }

  const detailedApplication = await getApplicationById(applications[0].id, {
    viewerRole: "client",
  });

  assert.ok(detailedApplication, "Expected application lookup to return a record");
  assert.ok("contactExchange" in detailedApplication, "Expected contactExchange on application");
  assert.ok("conversationId" in detailedApplication, "Expected conversationId on application");
  assert.ok("job" in detailedApplication, "Expected job summary on application");
}

async function main() {
  verifyStatusAliases();
  verifyContactPayloadAliases();
  await verifyApplicationResponseShape();

  console.log("Application status/contact contract verified.");
}

main().catch((error) => {
  console.error("Application contract verification failed:", error);
  process.exit(1);
});
