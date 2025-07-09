import { RequestHandler, Router } from "express";
import { login } from "./auth.controller";

const router = Router();

router.post("/login", login as RequestHandler);

export default router;
