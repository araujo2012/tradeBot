import WebSocket, { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import { IncomingMessage } from "http";

const JWT_SECRET = process.env.JWT_SECRET || "segredo_super_secreto";

// Mapa para armazenar conexões por userId
const userSockets = new Map<string, WebSocket>();

export function getUserSocket(userId: string): WebSocket | undefined {
  return userSockets.get(userId);
}

export function sendToUser(userId: string, data: any) {
  const ws = userSockets.get(userId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

export function broadcast(data: any) {
  for (const ws of userSockets.values()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }
}

export function initializeWebSocketServer(server: import("http").Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    // Autenticação via query string: ws://host/ws?token=xxx
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const token = url.searchParams.get("token");
    if (!token) {
      ws.close(4001, "Token ausente");
      return;
    }
    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch {
      ws.close(4002, "Token inválido");
      return;
    }
    const userId = payload.userId;
    if (!userId) {
      ws.close(4003, "Usuário não identificado");
      return;
    }
    userSockets.set(userId, ws);
    ws.on("close", () => {
      userSockets.delete(userId);
    });
    ws.on("message", (msg) => {
      // Aqui você pode tratar mensagens vindas do frontend
      // Exemplo: console.log(`Mensagem do usuário ${userId}:`, msg.toString());
    });
    ws.send(
      JSON.stringify({
        type: "connection",
        message: "WebSocket conectado com sucesso",
      })
    );
  });

  console.log("✅ WebSocket server inicializado em /ws");
}
