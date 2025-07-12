// src/app.ts (ou apenas app.ts na raiz)
import express, { RequestHandler } from "express";
import cors from "cors";
import binanceRoutes from "./app/binance/binance.route";
import sessionRoutes from "./app/session/session.routes";
import authRoutes from "./app/auth/auth.routes";
import userRoutes from "./app/user/user.routes";
import botRoutes from "./app/bot/bot.routes";
import botConfigRoutes from "./app/bot/botConfig.routes";
import { authMiddleware } from "./app/auth/auth.middleware";

const typedAuthMiddleware = authMiddleware as RequestHandler;

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL }));

app.use(express.json());

app.use("/auth", authRoutes);
app.use("/user", userRoutes);
app.use("/sessions", typedAuthMiddleware, sessionRoutes);
app.use("/binance", typedAuthMiddleware, binanceRoutes);
app.use("/bot", typedAuthMiddleware, botRoutes);
app.use("/bot", typedAuthMiddleware, botConfigRoutes);

export default app;
