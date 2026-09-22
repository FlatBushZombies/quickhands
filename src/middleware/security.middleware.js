import { slidingWindow } from "@arcjet/node";
import aj from "#config/arcjet.js";
import logger from "#config/logger.js";

const RATE_LIMITS_BY_ROLE = {
  admin: {
    limit: 200,
    message: "Admin request limit exceeded",
  },
  user: {
    limit: 120,
    message: "Too many requests. Please slow down.",
  },
  guest: {
    limit: 60,
    message: "Too many requests. Please slow down.",
  },
};

// clerk.middleware.js currently hardcodes every authenticated request's
// req.user.role to "user" — nothing in this codebase ever sets "admin".
// The admin tier below is real and will engage the moment something
// upstream starts assigning it (e.g. a real admin flag on the user record);
// until then every signed-in caller gets the "user" tier and this is inert
// rather than broken. Flagging this rather than inventing an admin-detection
// scheme this pass — that's a product decision (what makes someone an admin
// here?), not a rate-limiting one.
const securityClients = Object.fromEntries(
  Object.entries(RATE_LIMITS_BY_ROLE).map(([role, config]) => [
    role,
    aj.withRule(
      slidingWindow({
        mode: "LIVE",
        interval: "1m",
        max: config.limit,
        name: `${role}-rate-limit`,
        // Guests have no stable identity, so they still bucket by IP
        // (Arcjet's default `src.ip`) — the only signal available for them.
        // Authenticated tiers bucket per Clerk user instead: IP-keying meant
        // every signed-in user behind the same NAT/campus network/mobile
        // carrier shared one 120-req/min budget, so one busy user could
        // 429 everyone else on their network. userId is supplied per
        // request below, only for roles where req.user exists.
        ...(role === "guest" ? {} : { characteristics: ["userId"] }),
      })
    ),
  ])
);

export const securityMiddleware = async (req, res, next) => {
  try {
    const role = req.user?.role || "guest";
    const rateLimitConfig = RATE_LIMITS_BY_ROLE[role] || RATE_LIMITS_BY_ROLE.guest;
    const client = securityClients[role] || securityClients.guest;

    const decision =
      role === "guest"
        ? await client.protect(req)
        : await client.protect(req, { userId: req.user.clerkId });

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

      if (Number.isFinite(decision.reason.reset)) {
        res.set("Retry-After", String(Math.ceil(decision.reason.reset)));
      }

      return res.status(429).json({
        success: false,
        message: rateLimitConfig.message,
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
