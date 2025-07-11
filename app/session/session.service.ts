import { SessionModel } from "../../models/session";
import { startBinanceSocket, closeSocket } from "../binance/binance.socket";
import { BinanceService } from "../binance/binance.service";

export class SessionService {
  async getSessions(userId: string) {
    return await SessionModel.find({ userId });
  }

  async createSession(userId: string, sessionData: any) {
    return await SessionModel.create({ ...sessionData, userId });
  }

  async updateSession(sessionId: string, userId: string, updateData: any) {
    const session = await SessionModel.findOneAndUpdate(
      { _id: sessionId, userId },
      updateData,
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
    if (!session) {
      throw new Error("Session not found");
    }

    // Verificar se já tem listenKey
    if (session.listenKey) {
      try {
        // Tentar conectar com o listenKey existente
        await startBinanceSocket({
          listenKey: session.listenKey,
          sessionId: sessionId,
          apiKey: session.apiKey,
          apiSecret: session.apiSecret,
        });

        // Se chegou aqui, a conexão foi bem-sucedida
        await SessionModel.findByIdAndUpdate(sessionId, {
          status: "active",
        });

        return { message: "Session started successfully" };
      } catch (error) {
        console.log(
          "Failed to connect with existing listenKey, trying to generate new one"
        );
      }
    }

    // Gerar novo listenKey
    const binanceService = new BinanceService({
      apiKey: session.apiKey,
      apiSecret: session.apiSecret,
    });

    const listenKeyResult = await binanceService.getBinanceListenKey();
    if (listenKeyResult.error) {
      throw new Error(
        `Failed to generate listenKey: ${listenKeyResult.message}`
      );
    }

    const newListenKey = listenKeyResult.data.listenKey;

    // Tentar conectar com o novo listenKey
    try {
      await startBinanceSocket({
        listenKey: newListenKey,
        sessionId: sessionId,
        apiKey: session.apiKey,
        apiSecret: session.apiSecret,
      });

      // Atualizar sessão com novo listenKey e status ativo
      await SessionModel.findByIdAndUpdate(sessionId, {
        listenKey: newListenKey,
        status: "active",
      });

      return { message: "Session started successfully" };
    } catch (error) {
      throw new Error(
        `Failed to connect to Binance WebSocket: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async stopSession(sessionId: string, userId: string) {
    // Buscar a sessão
    const session = await SessionModel.findOne({ _id: sessionId, userId });
    if (!session) {
      throw new Error("Session not found");
    }

    // Encerrar a conexão do socket
    const socketClosed = closeSocket(sessionId);
    if (!socketClosed) {
      throw new Error("Failed to close WebSocket connection");
    }

    // Atualizar status da sessão para inactive
    await SessionModel.findByIdAndUpdate(sessionId, {
      status: "inactive",
    });

    return { message: "Session stopped successfully" };
  }
}
