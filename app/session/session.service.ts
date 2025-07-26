import { SessionModel } from "../../models/session";
import { getRabbitChannel } from "../lib/rabbit";

// Buscar todas as sessões de um usuário
async function getSessions(userId: string) {
  const sessions = await SessionModel.find({ userId }).select(
    "-apiKey -apiSecret"
  );
  return sessions;
}

// Criar nova sessão
async function createSession(userId: string, sessionData: any) {
  return await SessionModel.create({ ...sessionData, userId });
}

// Atualizar uma sessão existente
async function updateSession(
  sessionId: string,
  userId: string,
  updateData: any
) {
  const allowedFields = ["name", "limit"];
  const safeUpdateData: any = {};

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

// Deletar uma sessão
async function deleteSession(sessionId: string, userId: string) {
  const result = await SessionModel.findOneAndDelete({
    _id: sessionId,
    userId,
  });

  if (!result) {
    throw new Error("Session not found");
  }

  return result;
}

// Iniciar uma sessão (via fila RabbitMQ)
async function startSession(sessionId: string, userId: string) {
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

// Parar uma sessão (via fila RabbitMQ)
async function stopSession(sessionId: string, userId: string) {
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

// Reestabelecer conexão WebSocket para um usuário (a lógica pode ser implementada depois)
async function reconnectUserSocket(userId: string) {
  const sessions = await SessionModel.find({ userId });
  if (!sessions.length) {
    console.warn(`⚠️ Nenhuma sessão encontrada para o usuário ${userId}`);
    return;
  }
  const sessionIds = sessions.map((s) => s._id);
  await SessionModel.updateMany(
    { _id: { $in: sessionIds } },
    { $set: { status: "reconnecting" } }
  );
  const channel = getRabbitChannel();
  for (const session of sessions) {
    const message = {
      action: "restartSession",
      sessionId: session._id.toString(),
      userId,
    };
    channel.sendToQueue("socket", Buffer.from(JSON.stringify(message)), {
      persistent: true,
    });
  }
}

export const sessionService = {
  getSessions,
  createSession,
  reconnectUserSocket,
  stopSession,
  startSession,
  deleteSession,
  updateSession,
};
