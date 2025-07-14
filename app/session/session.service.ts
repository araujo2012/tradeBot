import { SessionModel } from "../../models/session";
import { socketUserStream } from "../binance/binance.socket.requests";
import { initializeBinanceSocket } from "../binance/binance.socket";
import { socketLogon } from "../binance/binance.socket.requests";

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
    const session = await SessionModel.findOne({ _id: sessionId, userId });
    if (!session) throw new Error("Session not found");

    try {
      await initializeBinanceSocket(userId);
      const logonResult = await socketLogon(session.apiKey, userId);

      if (logonResult.code && logonResult.code !== 0) {
        throw new Error(
          `Binance logon error: ${logonResult.msg || logonResult.code}`
        );
      }

      await socketUserStream(userId);

      await SessionModel.findByIdAndUpdate(sessionId, { status: "active" });

      return { message: "Session started successfully (WebSocket logon)" };
    } catch (error) {
      throw new Error(
        `Failed to connect to Binance WebSocket: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async stopSession(sessionId: string, userId: string) {
    const session = await SessionModel.findOne({ _id: sessionId, userId });
    if (!session) {
      throw new Error("Session not found");
    }

    // Atualizar status da sessão para inactive
    await SessionModel.findByIdAndUpdate(sessionId, {
      status: "inactive",
      listenKey: null,
    });

    return { message: "Session stopped successfully" };
  }
}
