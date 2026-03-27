import { verifyToken } from "@clerk/clerk-sdk-node";

function splitSecretList(value) {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(/[,\r\n;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function getConfiguredClerkSecretKeys() {
  const secrets = [
    ...splitSecretList(process.env.CLERK_SECRET_KEYS),
    ...splitSecretList(process.env.CLERK_ADDITIONAL_SECRET_KEYS),
    ...splitSecretList(process.env.CLERK_SECRET_KEY),
  ];

  return [...new Set(secrets)];
}

export function getConfiguredClerkSecretCount() {
  return getConfiguredClerkSecretKeys().length;
}

export async function verifyClerkToken(token) {
  const normalizedToken = typeof token === "string" ? token.trim() : "";
  if (!normalizedToken) {
    throw new Error("Missing Clerk token");
  }

  const secrets = getConfiguredClerkSecretKeys();
  if (secrets.length === 0) {
    throw new Error("No Clerk secret keys configured");
  }

  const failures = [];

  for (let index = 0; index < secrets.length; index += 1) {
    const secretKey = secrets[index];

    try {
      const payload = await verifyToken(normalizedToken, { secretKey });
      return {
        payload,
        secretIndex: index,
      };
    } catch (error) {
      failures.push(error);
    }
  }

  const primaryFailure = failures[0];
  const aggregateError = new Error(
    primaryFailure?.message || "Clerk token verification failed"
  );

  aggregateError.name = primaryFailure?.name || "ClerkTokenVerificationError";
  aggregateError.failures = failures.map((error) => ({
    name: error?.name || "Error",
    message: error?.message || "Unknown Clerk verification error",
  }));

  throw aggregateError;
}

