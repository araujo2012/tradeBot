import { Router } from "express";
import { startBinanceConnection } from "./binance.controller";

const router = Router();

router.post("/start", async (req, res, next) => {
  try {
    await startBinanceConnection(req, res);
  } catch (err) {
    next(err);
  }
});

export default router;
