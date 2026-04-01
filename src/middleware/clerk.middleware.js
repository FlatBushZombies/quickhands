import logger from "#config/logger.js";
import { getConfiguredClerkSecretCount, verifyClerkToken } from "#utils/clerkAuth.js";

function extractBearerToken(req) {
  const authHeader = req.headers.authorization || "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
}

function applyAuthenticatedUser(req, payload) {
  req.user = {
    clerkId: payload.sub,
    userName: payload.name || payload.email || "Anonymous",
    userAvatar: payload.picture || null,
    clerkIssuer: payload.iss || null,
  };
}

// Optional middleware to extract user info if token is present (doesn't require auth)
export async function clerkAuth(req, res, next) {
  try {
    const token = extractBearerToken(req);

    if (token) {
      try {
        const { payload, secretIndex } = await verifyClerkToken(token);

        if (payload) {
          req.authTokenInfo = { payload, secretIndex };
          applyAuthenticatedUser(req, payload);
        }
      } catch (authErr) {
        // Don't fail the request if token is invalid, just don't set user.
        logger.warn("Invalid token in clerkAuth middleware", {
          path: req.originalUrl,
          message: authErr.message,
        });
      }
    }

    next();
  } catch (err) {
    logger.error("Clerk auth middleware error", {
      path: req.originalUrl,
      message: err.message,
      stack: err.stack,
    });
    next();
  }
}

// Middleware to require authentication (used for protected routes)
export async function requireAuth(req, res, next) {
  try {
    if (req.user?.clerkId && req.authTokenInfo?.payload) {
      return next();
    }

    const token = extractBearerToken(req);

    if (!token) {
      return res.status(401).json({ success: false, message: "Missing auth token" });
    }

    const { payload, secretIndex } = await verifyClerkToken(token);

    if (!payload) {
      return res.status(401).json({ success: false, message: "Invalid token" });
    }

    req.authTokenInfo = { payload, secretIndex };
    applyAuthenticatedUser(req, payload);

    logger.info("Clerk authentication succeeded", {
      clerkId: req.user.clerkId,
      path: req.originalUrl,
      secretIndex: `${secretIndex + 1}/${getConfiguredClerkSecretCount()}`,
    });

    next();
  } catch (err) {
    logger.warn("Clerk auth error", {
      message: err.message,
      name: err.name,
      failures: err.failures,
      path: req.originalUrl,
    });
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
}

// Helper function to extract user info (alias for requireAuth)
export const extractUserInfo = requireAuth;
