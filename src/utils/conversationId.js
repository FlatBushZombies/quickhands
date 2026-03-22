import { v5 as uuidv5 } from "uuid";

/** Fixed namespace UUID so DM ids are deterministic for the same Clerk pair. */
const DM_NAMESPACE = "3e8b9c2d-1f4a-4f8e-9c3b-2d1e4f5a6b7c";

/**
 * Same id for both participants (order-independent).
 * @param {string} clerkIdA
 * @param {string} clerkIdB
 * @returns {string} UUID (v5)
 */
export function conversationIdForClerkPair(clerkIdA, clerkIdB) {
  const [a, b] = [String(clerkIdA), String(clerkIdB)].sort();
  return uuidv5(`${a}:${b}`, DM_NAMESPACE);
}
