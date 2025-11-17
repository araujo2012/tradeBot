import { Request, Response } from "express";
import { sessionService } from "./session.service";
import { botService } from "../bot/bot.service";

export async function getSessions(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    const sessions = await sessionService.getSessions(userId);
    const promises = sessions.map(async (session) => {
      const total = await botService.getTotalLimitBySession({
        userId,
        sessionId: session._id.toString(),
      });
      if (session.limit) {
        session.limit -= total;
      }
    });
    res.json(sessions);
  } catch (error) {
    console.error("Error getting sessions:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function createSession(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    const sessionData = req.body;
    const session = await sessionService.createSession(userId, sessionData);
    res.status(201).json(session);
  } catch (error) {
    console.error("Error creating session:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function updateSession(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    const sessionId = req.params.id;
    const updateData = req.body;
    const session = await sessionService.updateSession(
      sessionId,
      userId,
      updateData
    );
    res.json(session);
  } catch (error) {
    console.error("Error updating session:", error);
    if (error instanceof Error && error.message === "Session not found") {
      res.status(404).json({ error: "Session not found" });
    } else {
      res.status(500).json({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}

export async function deleteSession(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    const sessionId = req.params.id;
    await sessionService.deleteSession(sessionId, userId);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting session:", error);
    if (error instanceof Error && error.message === "Session not found") {
      res.status(404).json({ error: "Session not found" });
    } else {
      res.status(500).json({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}

export async function startSession(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    const sessionId = req.params.sessionId;
    const result = await sessionService.startSession(sessionId);
    res.json(result);
  } catch (error) {
    console.error("Error starting session:", error);
    if (error instanceof Error && error.message === "Session not found") {
      res.status(404).json({ error: "Session not found" });
    } else if (
      error instanceof Error &&
      error.message.includes("Failed to generate listenKey")
    ) {
      res.status(500).json({
        error: "Failed to generate listenKey",
        details: error.message,
      });
    } else if (
      error instanceof Error &&
      error.message.includes("Failed to connect to Binance WebSocket")
    ) {
      res.status(500).json({
        error: "Failed to connect to Binance WebSocket",
        details: error.message,
      });
    } else {
      res.status(500).json({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}

export async function stopSession(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    const sessionId = req.params.sessionId;
    const result = await sessionService.stopSession(sessionId, userId);
    res.json(result);
  } catch (error) {
    console.error("Error stopping session:", error);
    if (error instanceof Error && error.message === "Session not found") {
      res.status(404).json({ error: "Session not found" });
    } else if (
      error instanceof Error &&
      error.message === "Failed to close WebSocket connection"
    ) {
      res.status(500).json({
        error: "Failed to close WebSocket connection",
      });
    } else {
      res.status(500).json({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
