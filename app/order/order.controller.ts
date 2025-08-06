// app/order/order.controller.ts
import { Request, Response } from "express";
import { getActiveOrdersByUser } from "./order.service";

export async function getActiveOrders(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const orders = await getActiveOrdersByUser(userId);
    return res.json(orders);
  } catch (error) {
    console.error("Failed to fetch active orders:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}
