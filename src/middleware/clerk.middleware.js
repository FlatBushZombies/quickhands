import { clerkClient, verifyToken } from "@clerk/clerk-sdk-node";

// Optional middleware to extract user info if token is present (doesn't require auth)
export async function clerkAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "");
    
    if (token) {
      try {
        // ✅ Fixed: Use correct verifyToken syntax for current Clerk SDK
        const payload = await verifyToken(token, {
          secretKey: process.env.CLERK_SECRET_KEY, // Use SECRET_KEY, not API_KEY
        });
        
        if (payload) {
          req.user = {
            clerkId: payload.sub,
            userName: payload.name || payload.email || "Anonymous",
            userAvatar: payload.picture || null,
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
    
    console.log("🔑 RequireAuth - Token received:", token ? "Yes (" + token.length + " chars)" : "No");
    
    if (!token) {
      console.log("❌ RequireAuth - No token provided");
      return res.status(401).json({ success: false, message: "Missing auth token" });
    }

    // ✅ Fixed: Use correct verifyToken syntax
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY, // Use SECRET_KEY, not API_KEY
    });
    
    console.log("🔑 RequireAuth - Token verification:", payload ? "Success" : "Failed");
    
    if (!payload) {
      console.log("❌ RequireAuth - Invalid token payload");
      return res.status(401).json({ success: false, message: "Invalid token" });
    }

    // ✅ Attach user info from the JWT payload
    req.user = {
      clerkId: payload.sub, // JWT subject (user ID)
      userName: payload.name || payload.email || "Anonymous",
      userAvatar: payload.picture || null,
    };
    
    console.log("✅ RequireAuth - User authenticated:", {
      clerkId: req.user.clerkId,
      userName: req.user.userName
    });

    next();
  } catch (err) {
    console.error("❌ Clerk auth error:", {
      message: err.message,
      name: err.name,
      stack: err.stack?.substring(0, 200)
    });
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
}

// Helper function to extract user info (alias for requireAuth)
export const extractUserInfo = requireAuth;
