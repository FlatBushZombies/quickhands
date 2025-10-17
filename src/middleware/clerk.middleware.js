import { clerkClient, verifyToken } from "@clerk/clerk-sdk-node";

// Optional middleware to extract user info if token is present (doesn't require auth)
export async function clerkAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "");
    
    if (token) {
      try {
        const session = await verifyToken(token, { apiKey: process.env.CLERK_API_KEY });
        if (session) {
          req.user = {
            clerkId: session.sub,
            userName: session.name || session.email_address || "Anonymous",
            userAvatar: session.picture || null,
          };
        }
      } catch (authErr) {
        // Don't fail the request if token is invalid, just don't set user
        console.warn("Invalid token in clerkAuth middleware:", authErr.message);
      }
    }
    
    next();
  } catch (err) {
    console.error("Clerk auth middleware error:", err);
    next(); // Continue without user info
  }
}

// Middleware to require authentication (used for protected routes)
export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ success: false, message: "Missing auth token" });
    }

    // Verify the token with your backend-api template
    const session = await verifyToken(token, { apiKey: process.env.CLERK_API_KEY });
    if (!session) {
      return res.status(401).json({ success: false, message: "Invalid token" });
    }

    // Attach user info
    req.user = {
      clerkId: session.sub, // Clerk user ID
      userName: session.name || session.email_address || "Anonymous",
      userAvatar: session.picture || null,
    };

    next();
  } catch (err) {
    console.error("Clerk auth error:", err);
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
}

// Helper function to extract user info (alias for requireAuth)
export const extractUserInfo = requireAuth;
