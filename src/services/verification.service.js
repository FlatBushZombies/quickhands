import { sql } from "#config/database.js";

export const VERIFICATION_DOCUMENT_TYPES = ["id", "passport"];

function toVerificationView(row) {
  return {
    status: row.status,
    documentType: row.document_type,
    consentAt: row.consent_at,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at ?? null,
  };
}

export async function getVerificationByClerkId(clerkId) {
  const rows = await sql`
    SELECT status, document_type, consent_at, submitted_at, reviewed_at
    FROM user_verifications
    WHERE clerk_id = ${clerkId}
    LIMIT 1;
  `;
  return rows[0] ? toVerificationView(rows[0]) : null;
}

/**
 * Records a verification request for the user. Only the user's own request is
 * written here: a verified user cannot submit again, and 'verified' or
 * 'rejected' outcomes are set by a reviewer, never by this endpoint.
 * Returns null when the user is already verified.
 */
export async function submitVerificationRequest(clerkId, { documentType }) {
  const rows = await sql`
    INSERT INTO user_verifications (clerk_id, status, document_type, consent_at, submitted_at, updated_at)
    VALUES (${clerkId}, 'pending', ${documentType}, NOW(), NOW(), NOW())
    ON CONFLICT (clerk_id) DO UPDATE SET
      status = 'pending',
      document_type = EXCLUDED.document_type,
      consent_at = EXCLUDED.consent_at,
      submitted_at = NOW(),
      reviewed_at = NULL,
      updated_at = NOW()
    WHERE user_verifications.status <> 'verified'
    RETURNING status, document_type, consent_at, submitted_at, reviewed_at;
  `;
  return rows[0] ? toVerificationView(rows[0]) : null;
}
