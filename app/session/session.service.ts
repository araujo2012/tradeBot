import { SessionModel } from "../../models/session";
import { socketUserStream } from "../binance/binance.socket.requests";
import { initializeBinanceSocket } from "../binance/binance.socket";
import { socketLogon } from "../binance/binance.socket.requests";
import { getRabbitChannel } from "../lib/rabbit";

export class SessionService {
  async getSessions(userId: string) {
    const sessions = await SessionModel.find({ userId }).select(
      "-apiKey -apiSecret"
    );
    return sessions;
  }

  async createSession(userId: string, sessionData: any) {
    return await SessionModel.create({ ...sessionData, userId });
  }

  async updateSession(sessionId: string, userId: string, updateData: any) {
    // Permitir apenas atualização de name e limit
    const allowedFields = ["name", "limit"];
    const safeUpdateData: any = {};

    // Filtrar apenas os campos permitidos
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        safeUpdateData[field] = updateData[field];
      }
    }

    const session = await SessionModel.findOneAndUpdate(
      { _id: sessionId, userId },
      safeUpdateData,
      { new: true }
    );

    if (!session) {
      throw new Error("Session not found");
    }

    return session;
  }

  async deleteSession(sessionId: string, userId: string) {
    const result = await SessionModel.findOneAndDelete({
      _id: sessionId,
      userId,
    });

    if (!result) {
      throw new Error("Session not found");
    }

    return result;
  }

  async startSession(sessionId: string, userId: string) {
    // Envia para a fila RabbitMQ ao invés de executar diretamente
    const channel = getRabbitChannel();
    const message = {
      action: "startSession",
      sessionId,
      userId,
    };
    channel.sendToQueue("socket", Buffer.from(JSON.stringify(message)), {
      persistent: true,
    });
    return { message: "Session start request sent to queue" };
  }

  async stopSession(sessionId: string, userId: string) {
    // Envia para a fila RabbitMQ ao invés de executar diretamente
    const channel = getRabbitChannel();
    const message = {
      action: "stopSession",
      sessionId,
      userId,
    };
    channel.sendToQueue("socket", Buffer.from(JSON.stringify(message)), {
      persistent: true,
    });
    return { message: "Session stop request sent to queue" };
  }
}
