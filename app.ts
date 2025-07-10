// src/app.ts (ou apenas app.ts na raiz)
import express, { RequestHandler } from "express";
import cors from "cors";
import binanceRoutes from "./app/binance/binance.route";
import authRoutes from "./app/auth/auth.routes";
import userRoutes from "./app/user/user.routes";
import { authMiddleware } from "./app/auth/auth.middleware";

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL }));

app.use(express.json());

app.use("/auth", authRoutes);
app.use("/user", userRoutes);
app.use("/binance", authMiddleware as RequestHandler, binanceRoutes);

export default app;
