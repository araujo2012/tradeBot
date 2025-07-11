import { RequestHandler, Router } from "express";
import {
  createUser,
  getUser,
  updateUser,
  deleteUser,
  updateApiCredentials,
  updateLimit,
  updateProfile,
} from "./user.controller";
import { authMiddleware } from "../auth/auth.middleware";

const router = Router();

router.post("/", createUser);
router.use(authMiddleware as RequestHandler);

router.get("/", getUser as RequestHandler);
router.put("/", updateUser);
router.delete("/", deleteUser);
router.put("/limit", updateLimit);
router.put("/profile", updateProfile);

export default router;
