import { Request, Response } from "express";
import { botService } from "./bot.service";

export async function getBotsByUser(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    const bots = await botService.getBotsByUser(userId);
    res.json(bots);
  } catch (error) {
    console.error("Error getting bots:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function createBot(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    const bot = await botService.createBot(userId, req.body);
    res.status(201).json(bot);
  } catch (error) {
    console.error("Error creating bot:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateBot(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    const botId = req.params.botId;
    const bot = await botService.updateBot(botId, userId, req.body);
    res.json(bot);
  } catch (error) {
    console.error("Error updating bot:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function startBot(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    const botId = req.params.botId;
    const bot = await botService.startBot(botId);
    res.json(bot);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Session for this bot is not active"
    ) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Error starting bot:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function stopBot(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    const botId = req.params.botId;
    const bot = await botService.stopBot(botId, userId);
    res.json(bot);
  } catch (error) {
    console.error("Error stopping bot:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function archiveBot(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    const botId = req.params.botId;
    const bot = await botService.archiveBot(botId, userId);
    res.json(bot);
  } catch (error) {
    console.error("Error archiving bot:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
