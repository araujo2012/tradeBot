import { Request, Response } from "express";
import { findDefaultConfig } from "./botConfig.service";

/**
 * GET /bot/config/default
 * Get default bot configuration for the authenticated user
 */
export async function getDefaultConfig(
  req: Request,
  res: Response
): Promise<void> {
  try {
    // Get userId from the authenticated token
    const userId = (req as any).user?.userId;

    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const config = await findDefaultConfig();

    if (!config) {
      res.status(404).json({ error: "Default configuration not found" });
      return;
    }

    // Generate random values for periodo and largura
    const randomPeriod = Math.floor(Math.random() * 11); // 0 to 10 (integer)
    const randomWidth = Math.floor(Math.random() * 1001) / 100; // 0 to 10 (float with 2 decimal places)
    config.period = randomPeriod;
    config.width = randomWidth;
    res.status(200).json(config);
  } catch (error) {
    console.error("Error getting default bot config:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
