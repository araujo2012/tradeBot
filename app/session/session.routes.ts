import { RequestHandler, Router } from "express";
import {
  getSessions,
  createSession,
  updateSession,
  deleteSession,
} from "./session.controller";

const router = Router();

router.get("/", getSessions);
router.post("/", createSession);
router.put("/:id", updateSession as RequestHandler);
router.delete("/:id", deleteSession as RequestHandler);

export default router;
