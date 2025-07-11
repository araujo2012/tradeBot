import { RequestHandler, Router } from "express";
import {
  getSessions,
  createSession,
  updateSession,
  deleteSession,
  startSession,
  stopSession,
} from "./session.controller";

const router = Router();

router.get("/", getSessions as RequestHandler);
router.post("/", createSession as RequestHandler);
router.put("/:id", updateSession as RequestHandler);
router.delete("/:id", deleteSession as RequestHandler);
router.post("/:sessionId/start", startSession as RequestHandler);
router.post("/:sessionId/stop", stopSession as RequestHandler);

export default router;
