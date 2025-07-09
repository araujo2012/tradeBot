// user.routes.ts
import { RequestHandler, Router } from "express";
import {
  createUser,
  listUsers,
  getUser,
  updateUser,
  deleteUser,
} from "./user.controller";
import { authMiddleware } from "../auth/auth.middleware";

const router = Router();

router.post("/", createUser);
router.use(authMiddleware as RequestHandler);

router.get("/", listUsers);
router.get("/:id", getUser as RequestHandler);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);

export default router;
