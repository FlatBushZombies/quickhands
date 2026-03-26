import { v5 as uuidv5 } from "uuid";

/** Fixed namespace UUID so DM ids are deterministic for the same Clerk pair. */
const DIRECT_DM_NAMESPACE = "3e8b9c2d-1f4a-4f8e-9c3b-2d1e4f5a6b7c";
const JOB_DM_NAMESPACE = "92c3d7b5-2f8d-4c44-a925-16f09f952a64";

/**
 * Same id for both participants (order-independent).
 * @param {string} clerkIdA
 * @param {string} clerkIdB
 * @returns {string} UUID (v5)
 */
export function conversationIdForClerkPair(clerkIdA, clerkIdB) {
  const [a, b] = [String(clerkIdA), String(clerkIdB)].sort();
  return uuidv5(`${a}:${b}`, DIRECT_DM_NAMESPACE);
}

/**
 * Same id for the same job + both participants (order-independent).
 * @param {number|string} jobId
 * @param {string} clerkIdA
 * @param {string} clerkIdB
 * @returns {string} UUID (v5)
 */
export function conversationIdForJobClerkPair(jobId, clerkIdA, clerkIdB) {
  const [a, b] = [String(clerkIdA), String(clerkIdB)].sort();
  return uuidv5(`job:${jobId}:${a}:${b}`, JOB_DM_NAMESPACE);
}
