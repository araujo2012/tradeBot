import { BotConfig, IBotConfig } from "../../models/botConfig";

export class BotConfigService {
  /**
   * Find default bot configuration by userId
   */
  async findDefaultConfig(): Promise<IBotConfig | null> {
    try {
      const config = await BotConfig.findOne({ userId: "default" });
      return config;
    } catch (error) {
      throw new Error(`Error finding default bot config: ${error}`);
    }
  }

  /**
   * Create a new bot configuration
   */
  async createConfig(configData: {
    userId: string;
    buyProtection: number;
    sellProtection: number;
    periodo: number;
    largura: number;
    name: string;
  }): Promise<IBotConfig> {
    try {
      const config = new BotConfig(configData);
      return await config.save();
    } catch (error) {
      throw new Error(`Error creating bot config: ${error}`);
    }
  }

  /**
   * Update an existing bot configuration
   */
  async updateConfig(
    userId: string,
    updateData: {
      buyProtection?: number;
      sellProtection?: number;
      periodo?: number;
      largura?: number;
      name?: string;
    }
  ): Promise<IBotConfig | null> {
    try {
      const config = await BotConfig.findOneAndUpdate({ userId }, updateData, {
        new: true,
        runValidators: true,
      });
      return config;
    } catch (error) {
      throw new Error(`Error updating bot config: ${error}`);
    }
  }

  /**
   * Delete a bot configuration
   */
  async deleteConfig(userId: string): Promise<boolean> {
    try {
      const result = await BotConfig.deleteOne({ userId });
      return result.deletedCount > 0;
    } catch (error) {
      throw new Error(`Error deleting bot config: ${error}`);
    }
  }
}
