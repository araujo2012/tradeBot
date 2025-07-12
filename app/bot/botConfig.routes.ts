import { Router, RequestHandler } from "express";
import { BotConfigController } from "./botConfig.controller";

const router = Router();
const botConfigController = new BotConfigController();

/**
 * GET /bot/config/default
 * Get default bot configuration for the authenticated user
 */
router.get(
  "/config/default",
  botConfigController.getDefaultConfig.bind(
    botConfigController
  ) as RequestHandler
);

export default router;
