import { Request, Response } from "express";
import { BotConfigService } from "./botConfig.service";

export class BotConfigController {
  private botConfigService: BotConfigService;

  constructor() {
    this.botConfigService = new BotConfigService();
  }

  /**
   * GET /bot/config/default
   * Get default bot configuration for the authenticated user
   */
  async getDefaultConfig(req: Request, res: Response): Promise<void> {
    try {
      // Get userId from the authenticated token
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      const config = await this.botConfigService.findDefaultConfig();

      if (!config) {
        res.status(404).json({ error: "Default configuration not found" });
        return;
      }

      // Generate random values for periodo and largura
      const randomPeriodo = Math.floor(Math.random() * 11); // 0 to 10 (integer)
      const randomLargura = parseFloat((Math.random() * 11).toFixed(2)); // 0 to 10 (float with 2 decimal places)

      res.status(200).json({
        success: true,
        data: {
          userId: config.userId,
          buyProtection: config.buyProtection,
          sellProtection: config.sellProtection,
          periodo: randomPeriodo,
          largura: randomLargura,
          name: config.name,
        },
      });
    } catch (error) {
      console.error("Error getting default bot config:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}
