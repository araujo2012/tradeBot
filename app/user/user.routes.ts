import { RequestHandler, Router } from "express";
import {
  createUser,
  listUsers,
  getUser,
  updateUser,
  deleteUser,
} from "./user.controller";

const router = Router();

router.post("/", createUser as RequestHandler);
router.get("/", listUsers as RequestHandler);
router.get("/:id", getUser as RequestHandler);
router.put("/:id", updateUser as RequestHandler);
router.delete("/:id", deleteUser as RequestHandler);

export default router;
