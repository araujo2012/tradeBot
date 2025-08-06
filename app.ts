// src/app.ts (ou apenas app.ts na raiz)
import express, { RequestHandler } from "express";
import cors from "cors";
import sessionRoutes from "./app/session/session.routes";
import authRoutes from "./app/auth/auth.routes";
import userRoutes from "./app/user/user.routes";
import botRoutes from "./app/bot/bot.routes";
import orderRoutes from "./app/order/order.routes";
import { authMiddleware } from "./app/auth/auth.middleware";
import dotenv from "dotenv";
dotenv.config();
const typedAuthMiddleware = authMiddleware as RequestHandler;

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL }));

app.use(express.json());

app.use("/auth", authRoutes);
app.use("/user", userRoutes);
app.use("/sessions", typedAuthMiddleware, sessionRoutes);
app.use("/bot", typedAuthMiddleware, botRoutes);
app.use("/order", typedAuthMiddleware, orderRoutes);

export default app;
