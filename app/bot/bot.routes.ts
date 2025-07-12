import { Router, RequestHandler } from "express";
import {
  getBotsByUser,
  createBot,
  updateBot,
  startBot,
  stopBot,
  archiveBot,
} from "./bot.controller";
import { getDefaultConfig } from "./botConfig.controller";

const router = Router();

router.get("/", getBotsByUser as RequestHandler);
router.post("/", createBot as RequestHandler);
router.put("/:botId", updateBot as RequestHandler);
router.post("/:botId/start", startBot as RequestHandler);
router.post("/:botId/stop", stopBot as RequestHandler);
router.post("/:botId/archive", archiveBot as RequestHandler);
router.get("/config/default", getDefaultConfig as RequestHandler);
export default router;
