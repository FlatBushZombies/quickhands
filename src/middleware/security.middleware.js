import { slidingWindow } from "@arcjet/node";
import aj from "#config/arcjet.js";
import logger from "#config/logger.js";

const RATE_LIMITS_BY_ROLE = {
  admin: {
    limit: 100,
    message: "Admin request limit exceeded",
  },
  user: {
    limit: 50,
    message: "User request limit exceeded",
  },
  guest: {
    limit: 30,
    message: "Guest request limit exceeded",
  },
};

const securityClients = Object.fromEntries(
  Object.entries(RATE_LIMITS_BY_ROLE).map(([role, config]) => [
    role,
    aj.withRule(
      slidingWindow({
        mode: "LIVE",
        interval: "1m",
        max: config.limit,
        name: `${role}-rate-limit`,
      })
    ),
  ])
);

export const securityMiddleware = async (req, res, next) => {
  try {
    const role = req.user?.role || "guest";
    const rateLimitConfig = RATE_LIMITS_BY_ROLE[role] || RATE_LIMITS_BY_ROLE.guest;
    const client = securityClients[role] || securityClients.guest;

    const decision = await client.protect(req);

    if (decision.isDenied() && decision.reason.isBot()) {
      logger.warn("Bot request blocked", {
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        path: req.path,
      });

      return res
        .status(403)
        .json({ error: "Forbidden", message: "Automated requests are not allowed" });
    }

    if (decision.isDenied() && decision.reason.isShield()) {
      logger.warn("Shield block request", {
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        path: req.path,
        method: req.method,
      });

      return res
        .status(403)
        .json({ error: "Forbidden", message: "Request blocked by security policy" });
    }

    if (decision.isDenied() && decision.reason.isRateLimit()) {
      logger.warn("Rate limit exceeded", {
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        path: req.path,
        role,
      });

      return res.status(403).json({
        error: "Forbidden",
        message: "Too many requests",
        details: rateLimitConfig.message,
      });
    }

    next();
  } catch (error) {
    logger.error("Arcjet middleware error", {
      path: req.originalUrl,
      message: error.message,
      stack: error.stack,
    });
    return res.status(500).json({
      error: "Internal server error",
      message: "Something went wrong with security middleware",
    });
  }
};
