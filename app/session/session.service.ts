import { SessionModel } from "../../models/session";
import { logAndSendToQueue } from "../lib/rabbit";

async function getSessions(userId: string) {
  const sessions = await SessionModel.find({ userId }).select(
    "-apiKey -apiSecret"
  );
  return sessions;
}

async function createSession(userId: string, sessionData: any) {
  return await SessionModel.create({ ...sessionData, userId });
}

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

async function startSession(sessionId: string) {
  const message = {
    action: "startSession",
    sessionId,
  };
  logAndSendToQueue("socket", message);

  return { message: "Session start request sent to queue" };
}

async function stopSession(sessionId: string, userId: string) {
  const message = {
    action: "stopSession",
    sessionId,
    userId,
  };
  logAndSendToQueue("socket", message);

  return { message: "Session stop request sent to queue" };
}

async function reconnectUserSocket(sessionId: string) {
  const session = await SessionModel.findById(sessionId);
  if (!session) {
    console.warn(`⚠️ Nenhuma sessão encontrada com o id: ${sessionId}`);
    return;
  }
  session.status = "reconnecting";
  await session.save();
  const message = {
    action: "restartSession",
    sessionId: sessionId,
  };
  logAndSendToQueue("socket", message);
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
