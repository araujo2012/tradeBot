import { Router, RequestHandler } from "express";
import {
  getBotsByUser,
  createBot,
  updateBot,
  startBot,
  stopBot,
  archiveBot,
} from "./bot.controller";

const router = Router();

router.get("/bots", getBotsByUser as RequestHandler);
router.post("/bots", createBot as RequestHandler);
router.put("/bots/:botId", updateBot as RequestHandler);
router.post("/bot/:botId/start", startBot as RequestHandler);
router.post("/bot/:botId/stop", stopBot as RequestHandler);
router.post("/bot/:botId/archive", archiveBot as RequestHandler);

export default router;
