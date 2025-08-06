// app/order/order.routes.ts
import { RequestHandler, Router } from "express";
import { getActiveOrders } from "./order.controller";

const router = Router();

router.get("/activeOrders", getActiveOrders as any);

export default router;
