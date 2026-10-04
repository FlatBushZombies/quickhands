import logger from "#config/logger.js";
import { getPublicMarketplaceStats } from "#services/stats.service.js";

export async function getPublicStatsController(req, res) {
  try {
    const data = await getPublicMarketplaceStats();
    res.set("Cache-Control", "public, max-age=300");
    return res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("Error fetching public stats:", error.message);
    return res.status(500).json({ success: false, message: "Failed to load stats" });
  }
}
