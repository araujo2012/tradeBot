import { BotConfigModel, IBotConfig } from "../../models/botConfig";

/**
 * Find default bot configuration by userId
 */
export async function findDefaultConfig(): Promise<IBotConfig | null> {
  try {
    const config = await BotConfigModel.findOne({
      userId: "default",
    });
    return config;
  } catch (error) {
    throw new Error(`Error finding default bot config: ${error}`);
  }
}

/**
 * Create a new bot configuration
 */
export async function createConfig(configData: {
  userId: string;
  buyProtection: number;
  sellProtection: number;
  periodo: number;
  largura: number;
  name: string;
}): Promise<IBotConfig> {
  try {
    const config = new BotConfigModel(configData);
    return await config.save();
  } catch (error) {
    throw new Error(`Error creating bot config: ${error}`);
  }
}

/**
 * Update an existing bot configuration
 */
export async function updateConfig(
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
    const config = await BotConfigModel.findOneAndUpdate(
      { userId },
      updateData,
      {
        new: true,
        runValidators: true,
      }
    );
    return config;
  } catch (error) {
    throw new Error(`Error updating bot config: ${error}`);
  }
}

/**
 * Delete a bot configuration
 */
export async function deleteConfig(userId: string): Promise<boolean> {
  try {
    const result = await BotConfigModel.deleteOne({ userId });
    return result.deletedCount > 0;
  } catch (error) {
    throw new Error(`Error deleting bot config: ${error}`);
  }
}
