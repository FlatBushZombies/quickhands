import { clerkClient, verifyToken } from "@clerk/clerk-sdk-node";

// Middleware to attach user info from JWT to req.user
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
