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

      res.status(200).json({
        success: true,
        data: {
          userId: config.userId,
          buyProtection: config.buyProtection,
          sellProtection: config.sellProtection,
          periodo: config.periodo,
          largura: config.largura,
          name: config.name,
        },
      });
    } catch (error) {
      console.error("Error getting default bot config:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}
